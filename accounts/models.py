from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from django.urls import reverse

# Importar models de configuração no final do arquivo para evitar import circular


class Gabinete(models.Model):
    """Modelo para representar um gabinete político - genérico para qualquer mandato"""
    
    CARGO_CHOICES = [
        ('VEREADOR', 'Vereador(a)'),
        ('PREFEITO', 'Prefeito(a)'),
        ('VICE_PREFEITO', 'Vice-Prefeito(a)'),
        ('DEPUTADO_ESTADUAL', 'Deputado(a) Estadual'),
        ('DEPUTADO_FEDERAL', 'Deputado(a) Federal'),
        ('SENADOR', 'Senador(a)'),
        ('GOVERNADOR', 'Governador(a)'),
        ('SECRETARIO', 'Secretário(a)'),
    ]
    
    ESFERA_CHOICES = [
        ('MUNICIPAL', 'Municipal'),
        ('ESTADUAL', 'Estadual'),
        ('FEDERAL', 'Federal'),
    ]
    
    # Informações Básicas
    nome = models.CharField(max_length=200, verbose_name='Nome do Gabinete', 
                           help_text='Ex: Gabinete Vereador João Silva')
    slug = models.SlugField(max_length=200, unique=True, blank=True, null=True,
                           verbose_name='Slug (URL do Portal)',
                           help_text='URL amigável para o portal público. Ex: vereador-joao-silva')
    parlamentar_nome = models.CharField(max_length=200, verbose_name='Nome do Parlamentar/Titular')
    cargo = models.CharField(max_length=30, choices=CARGO_CHOICES, 
                            default='VEREADOR', verbose_name='Cargo')
    esfera = models.CharField(max_length=20, choices=ESFERA_CHOICES,
                             default='MUNICIPAL', verbose_name='Esfera')
    
    # Legislatura/Mandato
    legislatura_inicio = models.DateField(null=True, blank=True, 
                                         verbose_name='Início da Legislatura')
    legislatura_fim = models.DateField(null=True, blank=True,
                                      verbose_name='Fim da Legislatura')
    numero_legislatura = models.CharField(max_length=50, blank=True,
                                         verbose_name='Número/Nome da Legislatura',
                                         help_text='Ex: 19ª Legislatura')
    
    # Partido e Informações Políticas
    partido_sigla = models.CharField(max_length=10, blank=True, verbose_name='Sigla do Partido')
    partido_nome = models.CharField(max_length=100, blank=True, verbose_name='Nome do Partido')
    partido_logo = models.ImageField(upload_to='gabinete/logos/partido/', 
                                     blank=True, null=True, verbose_name='Logo do Partido')
    
    # Localização
    municipio = models.CharField(max_length=100, default='', verbose_name='Município')
    estado = models.CharField(max_length=2, default='SP', verbose_name='Estado (UF)')
    regiao = models.CharField(max_length=50, blank=True, verbose_name='Região',
                             help_text='Ex: Zona Norte, Vale do Paraíba')
    
    # Contato
    email = models.EmailField(verbose_name='E-mail Oficial')
    email_secundario = models.EmailField(blank=True, verbose_name='E-mail Secundário')
    telefone = models.CharField(max_length=20, verbose_name='Telefone Principal')
    telefone_secundario = models.CharField(max_length=20, blank=True, verbose_name='Telefone Secundário')
    whatsapp = models.CharField(max_length=20, blank=True, verbose_name='WhatsApp')
    
    # Endereço
    endereco = models.TextField(verbose_name='Endereço Completo')
    cep = models.CharField(max_length=10, blank=True, verbose_name='CEP')
    
    # Redes Sociais
    site = models.URLField(blank=True, verbose_name='Website')
    facebook = models.URLField(blank=True, verbose_name='Facebook')
    instagram = models.URLField(blank=True, verbose_name='Instagram')
    twitter = models.URLField(blank=True, verbose_name='Twitter/X')
    youtube = models.URLField(blank=True, verbose_name='YouTube')
    linkedin = models.URLField(blank=True, verbose_name='LinkedIn')
    
    # Identidade Visual
    logo = models.ImageField(upload_to='gabinete/logos/', blank=True, null=True,
                            verbose_name='Logo do Gabinete')
    brasao_municipio = models.ImageField(upload_to='gabinete/brasao/', blank=True, null=True,
                                        verbose_name='Brasão do Município/Estado')
    cor_primaria = models.CharField(max_length=7, default='#0D2A8B', 
                                   verbose_name='Cor Primária (HEX)',
                                   help_text='Ex: #0D2A8B')
    cor_secundaria = models.CharField(max_length=7, default='#FFFFFF',
                                     verbose_name='Cor Secundária (HEX)')
    
    # Informações Administrativas
    slogan = models.CharField(max_length=200, blank=True, verbose_name='Slogan/Lema')
    missao = models.TextField(blank=True, verbose_name='Missão')
    visao = models.TextField(blank=True, verbose_name='Visão')
    
    # Configurações do Portal do Cidadão
    horario_funcionamento = models.TextField(
        blank=True,
        verbose_name='Horários de Atendimento',
        help_text='Informe os horários de atendimento ao público',
        default='Segunda a Sexta: 08:00 às 12:00 e 14:00 às 18:00\nSábados: Mediante agendamento prévio\nDomingos e Feriados: Fechado'
    )
    sla_resposta_visitas = models.IntegerField(
        default=48,
        verbose_name='SLA de Resposta para Visitas (horas)',
        help_text='Prazo em horas para responder solicitações de visita'
    )
    sla_resposta_solicitacoes = models.IntegerField(
        default=72,
        verbose_name='SLA de Resposta para Solicitações (horas)',
        help_text='Prazo em horas para responder solicitações do cidadão'
    )
    
    # Controle
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Gabinete'
        verbose_name_plural = 'Gabinetes'
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} - {self.parlamentar_nome}"
    
    def save(self, *args, **kwargs):
        """Gera slug automaticamente se não existir"""
        if not self.slug:
            # Gera slug baseado no nome do parlamentar
            base_slug = slugify(self.parlamentar_nome)
            slug = base_slug
            counter = 1
            
            # Garante que o slug seja único
            while Gabinete.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            
            self.slug = slug
        
        super().save(*args, **kwargs)
    
    def get_absolute_url(self):
        """Retorna URL do portal público deste gabinete"""
        return reverse('portal:index', kwargs={'slug': self.slug})
    
    def get_cargo_completo(self):
        """Retorna o cargo formatado com o nome"""
        cargo_nome = dict(self.CARGO_CHOICES).get(self.cargo, self.cargo)
        return f"{cargo_nome} {self.parlamentar_nome}"
    
    @property
    def legislatura_ativa(self):
        """Verifica se a legislatura está ativa"""
        if not self.legislatura_inicio or not self.legislatura_fim:
            return True
        hoje = timezone.now().date()
        return self.legislatura_inicio <= hoje <= self.legislatura_fim
    
    @property
    def contato_completo(self):
        """Retorna string com todos os contatos"""
        contatos = []
        if self.telefone:
            contatos.append(f"Tel: {self.telefone}")
        if self.whatsapp:
            contatos.append(f"WhatsApp: {self.whatsapp}")
        if self.email:
            contatos.append(f"Email: {self.email}")
        return " | ".join(contatos)


class User(AbstractUser):
    """Modelo de usuário customizado"""
    PAPEL_CHOICES = [
        ('PARLAMENTAR', 'Parlamentar'),
        ('CHEFE', 'Chefe de Gabinete'),
        ('ATENDIMENTO', 'Atendimento'),
        ('JURIDICO', 'Jurídico'),
        ('COMUNICACAO', 'Comunicação'),
        ('FINANCEIRO', 'Financeiro'),
        ('ADMIN', 'Administrador'),
    ]

    email = models.EmailField(unique=True, verbose_name='E-mail')
    papel = models.CharField(
        max_length=20,
        choices=PAPEL_CHOICES,
        default='ATENDIMENTO',
        verbose_name='Papel'
    )
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='usuarios',
        verbose_name='Gabinete'
    )
    telefone = models.CharField(max_length=20, blank=True, verbose_name='Telefone')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        verbose_name = 'Usuário'
        verbose_name_plural = 'Usuários'
        ordering = ['first_name', 'last_name']

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_papel_display()})"

    def get_full_name(self):
        """Retorna o nome completo do usuário"""
        return f"{self.first_name} {self.last_name}".strip() or self.username

    def get_papel_display(self):
        """Retorna o papel formatado"""
        return dict(self.PAPEL_CHOICES).get(self.papel, self.papel)

    def can_manage_atendimentos(self):
        """Verifica se o usuário pode gerenciar atendimentos"""
        return self.papel in ['PARLAMENTAR', 'CHEFE', 'ADMIN']

    def can_manage_documentos(self):
        """Verifica se o usuário pode gerenciar documentos"""
        return self.papel in ['PARLAMENTAR', 'CHEFE', 'JURIDICO', 'ADMIN']

    def can_manage_pessoas(self):
        """Verifica se o usuário pode gerenciar pessoas"""
        return self.papel in ['PARLAMENTAR', 'CHEFE', 'ATENDIMENTO', 'ADMIN']


class Assunto(models.Model):
    """
    Categorias/Assuntos para classificação de demandas, documentos e atendimentos
    Ex: Saúde, Educação, Infraestrutura, Meio Ambiente, etc.
    """
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='assuntos',
        verbose_name='Gabinete',
        null=True,
        blank=True,
        help_text='Deixe em branco para assunto global (todos os gabinetes)'
    )
    nome = models.CharField(max_length=100, verbose_name='Nome do Assunto')
    descricao = models.TextField(blank=True, verbose_name='Descrição')
    cor = models.CharField(max_length=7, default='#6c757d', 
                          verbose_name='Cor (HEX)',
                          help_text='Cor para identificação visual')
    icone = models.CharField(max_length=50, blank=True,
                            verbose_name='Ícone (FontAwesome)',
                            help_text='Ex: fas fa-heart para saúde')
    ordem = models.IntegerField(default=0, verbose_name='Ordem de Exibição')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    
    class Meta:
        verbose_name = 'Assunto/Categoria'
        verbose_name_plural = 'Assuntos/Categorias'
        ordering = ['ordem', 'nome']
    
    def __str__(self):
        return self.nome


class ModeloDocumento(models.Model):
    """
    Templates/Modelos de documentos oficiais (ofícios, requerimentos, indicações)
    """
    TIPO_CHOICES = [
        ('OFICIO', 'Ofício'),
        ('MEMORANDO', 'Memorando'),
        ('REQUERIMENTO', 'Requerimento'),
        ('INDICACAO', 'Indicação'),
        ('MOCAO', 'Moção'),
        ('PROJETO_LEI', 'Projeto de Lei'),
        ('EMENDA', 'Emenda'),
    ]
    
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='modelos_documento',
        verbose_name='Gabinete'
    )
    nome = models.CharField(max_length=200, verbose_name='Nome do Modelo')
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, verbose_name='Tipo')
    assunto = models.ForeignKey(
        Assunto,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modelos',
        verbose_name='Assunto Padrão'
    )
    conteudo = models.TextField(verbose_name='Conteúdo do Template',
                                help_text='Use {{variavel}} para campos dinâmicos')
    cabecalho = models.TextField(blank=True, verbose_name='Cabeçalho Padrão')
    rodape = models.TextField(blank=True, verbose_name='Rodapé Padrão')
    variaveis_disponiveis = models.TextField(
        blank=True,
        verbose_name='Variáveis Disponíveis',
        help_text='Lista de variáveis que podem ser usadas. Ex: {{destinatario}}, {{data}}, {{numero}}'
    )
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    
    class Meta:
        verbose_name = 'Modelo de Documento'
        verbose_name_plural = 'Modelos de Documentos'
        ordering = ['tipo', 'nome']
    
    def __str__(self):
        return f"{self.get_tipo_display()} - {self.nome}"
    
    def renderizar(self, contexto):
        """
        Renderiza o template substituindo as variáveis
        contexto: dicionário com as variáveis e seus valores
        """
        conteudo_final = self.conteudo
        for chave, valor in contexto.items():
            conteudo_final = conteudo_final.replace(f"{{{{{chave}}}}}", str(valor))
        return conteudo_final


class JustificativaPadrao(models.Model):
    """
    Justificativas padrão para uso em documentos oficiais
    """
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='justificativas_padrao',
        verbose_name='Gabinete'
    )
    nome = models.CharField(
        max_length=200, 
        verbose_name='Nome da Justificativa',
        help_text='Nome identificador da justificativa'
    )
    descricao = models.TextField(
        blank=True, 
        verbose_name='Descrição',
        help_text='Descrição opcional da justificativa'
    )
    texto = models.TextField(
        verbose_name='Texto da Justificativa',
        help_text='Conteúdo da justificativa que será usado nos documentos'
    )
    ativo = models.BooleanField(
        default=True, 
        verbose_name='Ativo'
    )
    criado_em = models.DateTimeField(
        auto_now_add=True, 
        verbose_name='Criado em'
    )
    atualizado_em = models.DateTimeField(
        auto_now=True, 
        verbose_name='Atualizado em'
    )
    criado_por = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Criado por'
    )
    
    class Meta:
        verbose_name = 'Justificativa Padrão'
        verbose_name_plural = 'Justificativas Padrão'
        unique_together = ['gabinete', 'nome']
        ordering = ['nome']
    
    def __str__(self):
        return f"{self.nome} ({self.gabinete.nome})"


class SolicitacaoPadrao(models.Model):
    """
    Solicitações padrão para uso em documentos oficiais
    """
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='solicitacoes_padrao',
        verbose_name='Gabinete'
    )
    nome = models.CharField(
        max_length=200, 
        verbose_name='Nome da Solicitação',
        help_text='Nome identificador da solicitação'
    )
    descricao = models.TextField(
        blank=True, 
        verbose_name='Descrição',
        help_text='Descrição opcional da solicitação'
    )
    texto = models.TextField(
        verbose_name='Texto da Solicitação',
        help_text='Conteúdo da solicitação que será usado nos documentos'
    )
    ativo = models.BooleanField(
        default=True, 
        verbose_name='Ativo'
    )
    criado_em = models.DateTimeField(
        auto_now_add=True, 
        verbose_name='Criado em'
    )
    atualizado_em = models.DateTimeField(
        auto_now=True, 
        verbose_name='Atualizado em'
    )
    criado_por = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Criado por'
    )
    
    class Meta:
        verbose_name = 'Solicitação Padrão'
        verbose_name_plural = 'Solicitações Padrão'
        unique_together = ['gabinete', 'nome']
        ordering = ['nome']
    
    def __str__(self):
        return f"{self.nome} ({self.gabinete.nome})"


class LogAuditoria(models.Model):
    """Registra todas as ações importantes no sistema para auditoria e compliance"""
    
    ACAO_CHOICES = [
        ('CREATE', 'Criação'),
        ('UPDATE', 'Atualização'),
        ('DELETE', 'Exclusão'),
        ('VIEW', 'Visualização'),
        ('EXPORT', 'Exportação'),
        ('APPROVE', 'Aprovação'),
        ('SIGN', 'Assinatura'),
        ('SEND', 'Envio'),
        ('CANCEL', 'Cancelamento'),
    ]
    
    # Quem fez
    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs_auditoria',
        verbose_name='Usuário'
    )
    ip_address = models.GenericIPAddressField(verbose_name='Endereço IP')
    user_agent = models.TextField(blank=True, verbose_name='User Agent')
    
    # O que foi feito
    acao = models.CharField(max_length=20, choices=ACAO_CHOICES, verbose_name='Ação')
    modulo = models.CharField(max_length=50, verbose_name='Módulo',
                              help_text='Ex: atendimento, documento, agenda, etc')
    objeto_tipo = models.CharField(max_length=50, verbose_name='Tipo do Objeto',
                                   help_text='Nome do model')
    objeto_id = models.IntegerField(verbose_name='ID do Objeto')
    objeto_repr = models.CharField(max_length=200, verbose_name='Representação do Objeto',
                                   help_text='String representation do objeto')
    
    # Detalhes
    descricao = models.TextField(verbose_name='Descrição da Ação')
    dados_anteriores = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Dados Anteriores',
        help_text='Estado do objeto antes da alteração'
    )
    dados_novos = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Dados Novos',
        help_text='Estado do objeto após a alteração'
    )
    
    # Classificação
    critico = models.BooleanField(
        default=False,
        verbose_name='Ação Crítica',
        help_text='Marca ações sensíveis (exclusões, aprovações, assinaturas)'
    )
    
    # Metadados
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='logs_auditoria',
        verbose_name='Gabinete'
    )
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    
    class Meta:
        verbose_name = 'Log de Auditoria'
        verbose_name_plural = 'Logs de Auditoria'
        ordering = ['-criado_em']
        indexes = [
            models.Index(fields=['gabinete', 'criado_em']),
            models.Index(fields=['usuario', 'criado_em']),
            models.Index(fields=['modulo', 'criado_em']),
            models.Index(fields=['critico', 'criado_em']),
            models.Index(fields=['acao', 'criado_em']),
        ]
    
    def __str__(self):
        return f"{self.get_acao_display()} - {self.modulo} - {self.objeto_repr}"
    
    @property
    def usuario_nome(self):
        """Retorna nome do usuário ou 'Sistema' se não houver"""
        return self.usuario.get_full_name() if self.usuario else 'Sistema'


class Notificacao(models.Model):
    """Notificações internas do sistema"""
    
    TIPO_CHOICES = [
        ('INFO', 'Informação'),
        ('ALERTA', 'Alerta'),
        ('URGENTE', 'Urgente'),
        ('SUCESSO', 'Sucesso'),
        ('ERRO', 'Erro'),
    ]
    
    # Destinatário
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notificacoes',
        verbose_name='Usuário'
    )
    
    # Conteúdo
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default='INFO',
        verbose_name='Tipo'
    )
    titulo = models.CharField(max_length=200, verbose_name='Título')
    mensagem = models.TextField(verbose_name='Mensagem')
    link = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Link para Ação',
        help_text='URL interna para onde a notificação leva'
    )
    
    # Status
    lida = models.BooleanField(default=False, verbose_name='Lida')
    criada_em = models.DateTimeField(auto_now_add=True, verbose_name='Criada em')
    lida_em = models.DateTimeField(null=True, blank=True, verbose_name='Lida em')
    
    # Metadados
    enviado_email = models.BooleanField(default=False, verbose_name='E-mail Enviado')
    
    class Meta:
        verbose_name = 'Notificação'
        verbose_name_plural = 'Notificações'
        ordering = ['-criada_em']
        indexes = [
            models.Index(fields=['usuario', 'lida', 'criada_em']),
        ]
    
    def __str__(self):
        return f"{self.titulo} - {self.usuario.get_full_name()}"
    
    def marcar_como_lida(self):
        """Marca notificação como lida"""
        if not self.lida:
            self.lida = True
            self.lida_em = timezone.now()
            self.save()
    
    @property
    def cor_tipo(self):
        """Retorna a cor baseada no tipo"""
        cores = {
            'INFO': '#17a2b8',      # Azul
            'ALERTA': '#ffc107',    # Amarelo
            'URGENTE': '#fd7e14',   # Laranja
            'SUCESSO': '#28a745',   # Verde
            'ERRO': '#dc3545',      # Vermelho
        }
        return cores.get(self.tipo, '#6c757d')
    
    @property
    def icone_tipo(self):
        """Retorna o ícone FontAwesome baseado no tipo"""
        icones = {
            'INFO': 'fas fa-info-circle',
            'ALERTA': 'fas fa-exclamation-triangle',
            'URGENTE': 'fas fa-exclamation-circle',
            'SUCESSO': 'fas fa-check-circle',
            'ERRO': 'fas fa-times-circle',
        }
        return icones.get(self.tipo, 'fas fa-bell')

