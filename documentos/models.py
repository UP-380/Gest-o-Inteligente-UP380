from django.db import models
from django.utils import timezone
from accounts.models import Gabinete, User
from atendimento.models import proximo_numero


class TipoOrgao(models.Model):
    """Tipos de órgãos para destinatários (gerenciável dinamicamente)"""
    nome = models.CharField(max_length=100, unique=True, verbose_name='Nome do Tipo')
    descricao = models.TextField(blank=True, verbose_name='Descrição')
    ordem = models.IntegerField(default=0, verbose_name='Ordem de Exibição')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    
    class Meta:
        verbose_name = 'Tipo de Órgão'
        verbose_name_plural = 'Tipos de Órgão'
        ordering = ['ordem', 'nome']
    
    def __str__(self):
        return self.nome


class Destinatario(models.Model):
    """Modelo para destinatários padrões de documentos"""
    
    NIVEL_CHOICES = [
        ('MUNICIPAL', 'Municipal'),
        ('ESTADUAL', 'Estadual'),
        ('FEDERAL', 'Federal'),
        ('OUTRO', 'Outro'),
    ]
    
    # Informações Básicas
    nome = models.CharField(max_length=200, verbose_name='Nome Completo')
    cargo = models.CharField(max_length=200, verbose_name='Cargo/Função',
                            default='Não informado',
                            help_text='Ex: Secretário, Diretor, Prefeito')
    orgao = models.CharField(max_length=200, verbose_name='Órgão/Instituição',
                            default='Não informado',
                            help_text='Ex: Secretaria Municipal de Obras')
    
    # Classificação
    tipo_orgao = models.ForeignKey(
        TipoOrgao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='destinatarios',
        verbose_name='Tipo de Órgão'
    )
    nivel_administrativo = models.CharField(
        max_length=20,
        choices=NIVEL_CHOICES,
        default='MUNICIPAL',
        verbose_name='Nível Administrativo'
    )
    
    # Contato
    email = models.EmailField(verbose_name='E-mail Institucional', default='sem-email@exemplo.com')
    telefone = models.CharField(max_length=20, blank=True, verbose_name='Telefone')
    
    # Localização
    municipio = models.CharField(max_length=100, verbose_name='Município', default='Não informado')
    uf = models.CharField(max_length=2, verbose_name='UF (Estado)', default='SP')
    endereco = models.TextField(blank=True, verbose_name='Endereço Completo')
    
    # Observações e Status
    observacoes = models.TextField(blank=True, verbose_name='Observações',
                                   help_text='Ex: Solicitar protocolo ao enviar ofício')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    
    # Controle
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Destinatário Padrão'
        verbose_name_plural = 'Destinatários Padrões'
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} - {self.cargo} ({self.orgao})"
    
    @property
    def localizacao_completa(self):
        """Retorna município/UF formatado"""
        return f"{self.municipio}/{self.uf}"
    
    @property
    def identificacao_completa(self):
        """Retorna identificação completa do destinatário"""
        return f"{self.nome}\n{self.cargo}\n{self.orgao}"


class DocumentoBase(models.Model):
    """Modelo abstrato base para documentos oficiais"""
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('EM_ANDAMENTO', 'Em Andamento'),
        ('EM_VALIDACAO', 'Em Validação'),
        ('CONCLUIDO', 'Concluído'),
        ('RASCUNHO', 'Rascunho'),
        ('REVISAO', 'Em Revisão'),
        ('APROVADO', 'Aprovado'),
        ('ASSINADO', 'Assinado'),
        ('ENVIADO', 'Enviado'),
        ('ARQUIVADO', 'Arquivado'),
    ]

    # Informações Básicas
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='%(class)s_documentos',
        verbose_name='Gabinete'
    )
    numero = models.CharField(
        max_length=20,
        verbose_name='Número do Documento'
    )
    data = models.DateField(default=timezone.now, verbose_name='Data')
    
    # Conteúdo
    assunto = models.CharField(max_length=200, verbose_name='Assunto')
    corpo = models.TextField(verbose_name='Corpo do Documento')
    categoria = models.ForeignKey(
        'accounts.Assunto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_documentos',
        verbose_name='Categoria'
    )
    
    # Destinatário
    destinatario = models.ForeignKey(
        Destinatario,
        on_delete=models.CASCADE,
        related_name='%(class)s_documentos',
        verbose_name='Destinatário'
    )
    copia_para = models.ManyToManyField(
        Destinatario,
        blank=True,
        related_name='%(class)s_copia',
        verbose_name='Cópia para'
    )
    
    # Pessoa Interessada (do CRM)
    pessoa_interessada = models.ForeignKey(
        'crm.Pessoa',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_interessada',
        verbose_name='Pessoa Interessada'
    )
    
    # Responsável pelo Ofício
    responsavel = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_responsavel',
        verbose_name='Responsável pelo Ofício'
    )
    
    # Status e Controle
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDENTE',
        verbose_name='Status'
    )
    prioridade = models.IntegerField(
        choices=[
            (1, 'Baixa'),
            (2, 'Normal'),
            (3, 'Alta'),
            (4, 'Urgente'),
        ],
        default=2,
        verbose_name='Prioridade'
    )
    
    # Arquivos
    arquivo = models.FileField(
        upload_to='documentos/%Y/%m/',
        blank=True,
        null=True,
        verbose_name='Arquivo PDF'
    )
    anexos = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Anexos',
        help_text='Lista de arquivos anexos'
    )
    
    # Rastreabilidade
    atendimento = models.ForeignKey(
        'atendimento.Atendimento',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_gerados',
        verbose_name='Atendimento de Origem'
    )
    evento = models.ForeignKey(
        'agenda.Evento',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_gerados',
        verbose_name='Evento Relacionado'
    )
    
    # Observações
    observacoes = models.TextField(blank=True, verbose_name='Observações Internas')
    fundamentacao = models.TextField(blank=True, verbose_name='Fundamentação Legal')
    
    # Metadados e Datas
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    criado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_criados',
        verbose_name='Criado por'
    )
    revisado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_revisados',
        verbose_name='Revisado por'
    )
    aprovado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_aprovados',
        verbose_name='Aprovado por'
    )
    assinado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_assinados',
        verbose_name='Assinado por'
    )
    assinado_em = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Assinado em'
    )
    enviado_em = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Enviado em'
    )

    class Meta:
        abstract = True
        ordering = ['-criado_em']

    def __str__(self):
        return f"{self.numero} - {self.assunto}"

    def save(self, *args, **kwargs):
        # Se status mudou para ASSINADO, definir data de assinatura
        if self.status == 'ASSINADO' and not self.assinado_em:
            self.assinado_em = timezone.now()
        elif self.status != 'ASSINADO':
            self.assinado_em = None
            
        # Se status mudou para ENVIADO, definir data de envio
        if self.status == 'ENVIADO' and not self.enviado_em:
            self.enviado_em = timezone.now()
        elif self.status != 'ENVIADO':
            self.enviado_em = None
            
        super().save(*args, **kwargs)

    @property
    def pode_editar(self):
        """Verifica se o documento pode ser editado"""
        return self.status == 'RASCUNHO'

    @property
    def pode_assinado(self):
        """Verifica se o documento pode ser assinado"""
        return self.status in ['RASCUNHO', 'ASSINADO']

    @property
    def pode_enviar(self):
        """Verifica se o documento pode ser enviado"""
        return self.status in ['ASSINADO', 'ENVIADO']


class Oficio(DocumentoBase):
    """Modelo para ofícios"""
    
    # Campo para justificativa padrão
    justificativa_padrao = models.ForeignKey(
        'accounts.JustificativaPadrao',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='oficios_utilizando',
        verbose_name='Justificativa Padrão'
    )
    
    # Campo para solicitação padrão
    solicitacao_padrao = models.ForeignKey(
        'accounts.SolicitacaoPadrao',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='oficios_utilizando',
        verbose_name='Solicitação Padrão'
    )
    
    class Meta:
        verbose_name = 'Ofício'
        verbose_name_plural = 'Ofícios'
        unique_together = ['gabinete', 'numero']

    def save(self, *args, **kwargs):
        # Gerar número se for um novo ofício (não tem pk)
        if not self.pk and not self.numero:
            self.numero = proximo_numero(self.gabinete, 'OFICIO')
        super().save(*args, **kwargs)


class Memorando(DocumentoBase):
    """Modelo para memorandos"""
    
    class Meta:
        verbose_name = 'Memorando'
        verbose_name_plural = 'Memorandos'
        unique_together = ['gabinete', 'numero']

    def save(self, *args, **kwargs):
        # Gerar número se for um novo memorando (não tem pk)
        if not self.pk and not self.numero:
            self.numero = proximo_numero(self.gabinete, 'MEMORANDO')
        super().save(*args, **kwargs)


class Requerimento(DocumentoBase):
    """Modelo para requerimentos parlamentares"""
    
    TIPO_REQUERIMENTO_CHOICES = [
        ('INFORMACAO', 'Requerimento de Informação'),
        ('AUDIENCIA', 'Requerimento de Audiência Pública'),
        ('VOTO_PESAR', 'Voto de Pesar'),
        ('VOTO_CONGRATULACAO', 'Voto de Congratulações'),
        ('VOTO_APLAUSO', 'Voto de Aplauso'),
        ('URGENCIA', 'Requerimento de Urgência'),
        ('PRORROGACAO', 'Requerimento de Prorrogação'),
        ('PREFERENCIA', 'Requerimento de Preferência'),
        ('DESTAQUE', 'Requerimento de Destaque'),
        ('OUTROS', 'Outros'),
    ]
    
    tipo_requerimento = models.CharField(
        max_length=30,
        choices=TIPO_REQUERIMENTO_CHOICES,
        default='INFORMACAO',
        verbose_name='Tipo de Requerimento'
    )
    
    # Específico para requerimentos
    prazo_resposta_dias = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Prazo para Resposta (dias)',
        help_text='Prazo legal para resposta ao requerimento'
    )
    respondido = models.BooleanField(default=False, verbose_name='Foi Respondido?')
    data_resposta = models.DateField(null=True, blank=True, verbose_name='Data da Resposta')
    resposta = models.TextField(blank=True, verbose_name='Resposta Recebida')
    protocolo_resposta = models.CharField(max_length=50, blank=True, verbose_name='Protocolo da Resposta')
    
    class Meta:
        verbose_name = 'Requerimento'
        verbose_name_plural = 'Requerimentos'
        unique_together = ['gabinete', 'numero']

    def save(self, *args, **kwargs):
        # Gerar número se for um novo requerimento (não tem pk)
        if not self.pk and not self.numero:
            self.numero = proximo_numero(self.gabinete, 'REQUERIMENTO')
        super().save(*args, **kwargs)
    
    @property
    def prazo_vencido(self):
        """Verifica se o prazo de resposta venceu"""
        if not self.respondido and self.prazo_resposta_dias and self.data:
            from datetime import timedelta
            prazo_final = self.data + timedelta(days=self.prazo_resposta_dias)
            return timezone.now().date() > prazo_final
        return False


class Indicacao(DocumentoBase):
    """Modelo para indicações parlamentares"""
    
    TIPO_INDICACAO_CHOICES = [
        ('OBRA', 'Indicação de Obra'),
        ('SERVICO', 'Indicação de Serviço'),
        ('ESTUDO', 'Indicação de Estudo'),
        ('PROVIDENCIA', 'Indicação de Providência'),
        ('SUGESTAO', 'Sugestão'),
        ('OUTROS', 'Outros'),
    ]
    
    STATUS_EXECUCAO_CHOICES = [
        ('PROTOCOLADA', 'Protocolada'),
        ('EM_ANALISE', 'Em Análise'),
        ('APROVADA', 'Aprovada'),
        ('EM_EXECUCAO', 'Em Execução'),
        ('EXECUTADA', 'Executada'),
        ('NAO_APROVADA', 'Não Aprovada'),
        ('ARQUIVADA', 'Arquivada'),
    ]
    
    tipo_indicacao = models.CharField(
        max_length=30,
        choices=TIPO_INDICACAO_CHOICES,
        default='PROVIDENCIA',
        verbose_name='Tipo de Indicação'
    )
    
    # Específico para indicações
    status_execucao = models.CharField(
        max_length=20,
        choices=STATUS_EXECUCAO_CHOICES,
        default='PROTOCOLADA',
        verbose_name='Status de Execução'
    )
    
    # Localização (importante para obras e serviços)
    municipio = models.CharField(max_length=100, blank=True, verbose_name='Município')
    bairro = models.CharField(max_length=100, blank=True, verbose_name='Bairro')
    endereco_referencia = models.TextField(blank=True, verbose_name='Endereço/Referência')
    
    # Valores e custos
    valor_estimado = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Valor Estimado (R$)'
    )
    
    # Acompanhamento
    justificativa = models.TextField(blank=True, verbose_name='Justificativa')
    beneficiados_estimado = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Número Estimado de Beneficiados'
    )
    
    # Resposta e andamento
    resposta_orgao = models.TextField(blank=True, verbose_name='Resposta do Órgão')
    data_resposta = models.DateField(null=True, blank=True, verbose_name='Data da Resposta')
    data_inicio_execucao = models.DateField(null=True, blank=True, verbose_name='Data Início Execução')
    data_conclusao_execucao = models.DateField(null=True, blank=True, verbose_name='Data Conclusão')
    percentual_execucao = models.IntegerField(
        default=0,
        verbose_name='Percentual de Execução (%)',
        help_text='0 a 100'
    )
    
    class Meta:
        verbose_name = 'Indicação'
        verbose_name_plural = 'Indicações'
        unique_together = ['gabinete', 'numero']

    def save(self, *args, **kwargs):
        # Gerar número se for uma nova indicação (não tem pk)
        if not self.pk and not self.numero:
            self.numero = proximo_numero(self.gabinete, 'INDICACAO')
        super().save(*args, **kwargs)
    
    @property
    def em_execucao(self):
        """Verifica se a indicação está em execução"""
        return self.status_execucao in ['EM_EXECUCAO', 'EXECUTADA']
    
    @property
    def foi_aprovada(self):
        """Verifica se a indicação foi aprovada"""
        return self.status_execucao in ['APROVADA', 'EM_EXECUCAO', 'EXECUTADA']



