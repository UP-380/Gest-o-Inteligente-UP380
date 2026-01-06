from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from datetime import timedelta

from accounts.models import Gabinete
from atendimento.models import Atendimento


class TipoProposicao(models.Model):
    """Tipos de proposições legislativas"""
    ESFERA_CHOICES = [
        ('MUNICIPAL', 'Municipal'),
        ('ESTADUAL', 'Estadual'),
        ('FEDERAL', 'Federal'),
    ]
    
    nome = models.CharField(max_length=100, help_text="Ex: Projeto de Lei, Requerimento, Moção")
    sigla = models.CharField(max_length=10, help_text="Ex: PL, REQ, MOC")
    esfera = models.CharField(max_length=20, choices=ESFERA_CHOICES)
    descricao = models.TextField(blank=True)
    
    # Configurações específicas
    requer_justificativa = models.BooleanField(default=True)
    requer_impacto_orcamentario = models.BooleanField(default=False)
    prazo_tramitacao_dias = models.IntegerField(default=180, help_text="Prazo médio de tramitação")
    
    # Numeração
    usa_numeracao_sequencial = models.BooleanField(default=True)
    prefixo_numeracao = models.CharField(max_length=20, blank=True)
    
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Tipo de Proposição"
        verbose_name_plural = "Tipos de Proposições"
        ordering = ['esfera', 'nome']
        unique_together = ['nome', 'esfera']
    
    def __str__(self):
        return f"{self.nome} ({self.get_esfera_display()})"
    
    def proximo_numero(self, ano=None):
        """Retorna o próximo número sequencial para este tipo"""
        if not self.usa_numeracao_sequencial:
            return None
        
        if ano is None:
            ano = timezone.now().year
        
        ultimo_numero = Proposicao.objects.filter(
            tipo=self,
            numero__isnull=False,
            ano=ano
        ).aggregate(
            max_numero=models.Max('numero')
        )['max_numero'] or 0
        
        return ultimo_numero + 1


class AreaTematica(models.Model):
    """Áreas temáticas para classificação das proposições"""
    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True)
    cor = models.CharField(max_length=7, default='#007bff', help_text="Cor em hexadecimal")
    ativa = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = "Área Temática"
        verbose_name_plural = "Áreas Temáticas"
        ordering = ['nome']
    
    def __str__(self):
        return self.nome


class Proposicao(models.Model):
    """Proposições legislativas"""
    STATUS_CHOICES = [
        ('RASCUNHO', 'Rascunho'),
        ('EM_ELABORACAO', 'Em Elaboração'),
        ('AGUARDANDO_REVISAO', 'Aguardando Revisão'),
        ('PRONTA_PROTOCOLO', 'Pronta para Protocolo'),
        ('PROTOCOLADA', 'Protocolada'),
        ('EM_TRAMITACAO', 'Em Tramitação'),
        ('APROVADA', 'Aprovada'),
        ('REJEITADA', 'Rejeitada'),
        ('ARQUIVADA', 'Arquivada'),
        ('RETIRADA', 'Retirada'),
    ]
    
    PRIORIDADE_CHOICES = [
        ('BAIXA', 'Baixa'),
        ('NORMAL', 'Normal'),
        ('ALTA', 'Alta'),
        ('URGENTE', 'Urgente'),
    ]
    
    # Identificação
    gabinete = models.ForeignKey(Gabinete, on_delete=models.CASCADE)
    tipo = models.ForeignKey(TipoProposicao, on_delete=models.CASCADE)
    numero = models.IntegerField(null=True, blank=True)
    ano = models.IntegerField(default=timezone.now().year)
    titulo = models.CharField(max_length=200)
    ementa = models.TextField(help_text="Resumo do que a proposição dispõe")
    
    # Conteúdo
    justificativa = models.TextField(blank=True)
    texto_integral = models.TextField(blank=True)
    impacto_orcamentario = models.TextField(blank=True)
    
    # Classificação
    area_tematica = models.ForeignKey(AreaTematica, on_delete=models.SET_NULL, null=True, blank=True)
    palavras_chave = models.CharField(max_length=500, blank=True, help_text="Separadas por vírgula")
    
    # Status e controle
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='RASCUNHO')
    prioridade = models.CharField(max_length=10, choices=PRIORIDADE_CHOICES, default='NORMAL')
    
    # Relacionamentos
    atendimento_origem = models.ForeignKey(
        Atendimento, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        help_text="Atendimento que originou esta proposição"
    )
    
    # Responsabilidade
    autor_principal = models.ForeignKey(User, on_delete=models.CASCADE, related_name='proposicoes_autor')
    colaboradores = models.ManyToManyField(User, blank=True, related_name='proposicoes_colaborador')
    
    # Prazos
    prazo_interno = models.DateField(null=True, blank=True, help_text="Prazo interno para conclusão")
    data_protocolo = models.DateTimeField(null=True, blank=True)
    prazo_tramitacao = models.DateField(null=True, blank=True)
    
    # Protocolo e tramitação
    numero_protocolo = models.CharField(max_length=50, blank=True)
    orgao_destino = models.CharField(max_length=200, blank=True)
    
    # Métricas
    visualizacoes = models.IntegerField(default=0)
    downloads = models.IntegerField(default=0)
    
    # Auditoria
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    criado_por = models.ForeignKey(User, on_delete=models.CASCADE, related_name='proposicoes_criadas')
    
    class Meta:
        verbose_name = "Proposição"
        verbose_name_plural = "Proposições"
        ordering = ['-criado_em']
        unique_together = ['tipo', 'numero', 'ano']
    
    def __str__(self):
        if self.numero:
            return f"{self.tipo.sigla} {self.numero}/{self.ano} - {self.titulo}"
        return f"{self.tipo.nome} - {self.titulo}"
    
    @property
    def identificacao_completa(self):
        """Retorna a identificação completa da proposição"""
        if self.numero:
            return f"{self.tipo.sigla} nº {self.numero}/{self.ano}"
        return f"{self.tipo.nome} (sem número)"
    
    @property
    def em_atraso(self):
        """Verifica se a proposição está em atraso"""
        if self.prazo_interno and self.status not in ['PROTOCOLADA', 'APROVADA', 'REJEITADA', 'ARQUIVADA']:
            return timezone.now().date() > self.prazo_interno
        return False
    
    @property
    def dias_para_prazo(self):
        """Calcula quantos dias restam para o prazo interno"""
        if self.prazo_interno:
            delta = self.prazo_interno - timezone.now().date()
            return delta.days
        return None
    
    @property
    def percentual_conclusao(self):
        """Calcula o percentual de conclusão baseado no status"""
        status_percentuais = {
            'RASCUNHO': 10,
            'EM_ELABORACAO': 30,
            'AGUARDANDO_REVISAO': 60,
            'PRONTA_PROTOCOLO': 80,
            'PROTOCOLADA': 90,
            'EM_TRAMITACAO': 95,
            'APROVADA': 100,
            'REJEITADA': 100,
            'ARQUIVADA': 100,
            'RETIRADA': 100,
        }
        return status_percentuais.get(self.status, 0)
    
    def save(self, *args, **kwargs):
        # Gerar número sequencial se necessário
        if not self.numero and self.tipo.usa_numeracao_sequencial:
            self.numero = self.tipo.proximo_numero(self.ano)
        
        # Definir prazo de tramitação baseado no tipo
        if not self.prazo_tramitacao and self.data_protocolo:
            self.prazo_tramitacao = (
                self.data_protocolo.date() + 
                timedelta(days=self.tipo.prazo_tramitacao_dias)
            )
        
        super().save(*args, **kwargs)
    
    def protocolar(self, numero_protocolo, orgao_destino, usuario=None):
        """Protocola a proposição"""
        self.status = 'PROTOCOLADA'
        self.numero_protocolo = numero_protocolo
        self.orgao_destino = orgao_destino
        self.data_protocolo = timezone.now()
        self.save()
        
        # Registrar no histórico
        HistoricoProposicao.objects.create(
            proposicao=self,
            usuario=usuario,
            acao='PROTOCOLO',
            descricao=f'Proposição protocolada sob nº {numero_protocolo} no {orgao_destino}'
        )
    
    def arquivar(self, motivo="", usuario=None):
        """Arquiva a proposição"""
        self.status = 'ARQUIVADA'
        self.save()
        
        HistoricoProposicao.objects.create(
            proposicao=self,
            usuario=usuario,
            acao='ARQUIVAMENTO',
            descricao=f'Proposição arquivada. Motivo: {motivo}'
        )


class VersaoProposicao(models.Model):
    """Controle de versões das proposições"""
    proposicao = models.ForeignKey(Proposicao, on_delete=models.CASCADE, related_name='versoes')
    numero_versao = models.IntegerField(default=1)
    titulo = models.CharField(max_length=200)
    ementa = models.TextField()
    justificativa = models.TextField(blank=True)
    texto_integral = models.TextField(blank=True)
    
    # Controle de mudanças
    alteracoes_realizadas = models.TextField(blank=True, help_text="Descrição das alterações")
    
    # Auditoria
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        verbose_name = "Versão da Proposição"
        verbose_name_plural = "Versões das Proposições"
        ordering = ['-numero_versao']
        unique_together = ['proposicao', 'numero_versao']
    
    def __str__(self):
        return f"{self.proposicao} - Versão {self.numero_versao}"
    
    def save(self, *args, **kwargs):
        if not self.numero_versao:
            ultima_versao = VersaoProposicao.objects.filter(
                proposicao=self.proposicao
            ).aggregate(
                max_versao=models.Max('numero_versao')
            )['max_versao'] or 0
            
            self.numero_versao = ultima_versao + 1
        
        super().save(*args, **kwargs)


class AnexoProposicao(models.Model):
    """Anexos das proposições"""
    TIPO_CHOICES = [
        ('DOCUMENTO', 'Documento'),
        ('PLANILHA', 'Planilha'),
        ('APRESENTACAO', 'Apresentação'),
        ('IMAGEM', 'Imagem'),
        ('PARECER', 'Parecer Técnico'),
        ('ESTUDO', 'Estudo/Pesquisa'),
        ('OUTRO', 'Outro'),
    ]
    
    proposicao = models.ForeignKey(Proposicao, on_delete=models.CASCADE, related_name='anexos')
    nome = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='DOCUMENTO')
    arquivo = models.FileField(upload_to='proposicoes/anexos/%Y/%m/')
    tamanho_arquivo = models.IntegerField(null=True, blank=True)  # em bytes
    
    # Controle
    publico = models.BooleanField(default=False, help_text="Anexo pode ser visualizado publicamente")
    obrigatorio = models.BooleanField(default=False, help_text="Anexo obrigatório para protocolo")
    
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        verbose_name = "Anexo da Proposição"
        verbose_name_plural = "Anexos das Proposições"
        ordering = ['-criado_em']
    
    def __str__(self):
        return f"{self.proposicao} - {self.nome}"
    
    @property
    def tamanho_formatado(self):
        """Retorna o tamanho do arquivo formatado"""
        if not self.tamanho_arquivo:
            return "N/A"
        
        if self.tamanho_arquivo < 1024:
            return f"{self.tamanho_arquivo} bytes"
        elif self.tamanho_arquivo < 1024 * 1024:
            return f"{self.tamanho_arquivo / 1024:.1f} KB"
        else:
            return f"{self.tamanho_arquivo / (1024 * 1024):.1f} MB"


class TramitacaoProposicao(models.Model):
    """Controle de tramitação das proposições"""
    STATUS_CHOICES = [
        ('RECEBIDA', 'Recebida'),
        ('DISTRIBUIDA', 'Distribuída'),
        ('EM_ANALISE', 'Em Análise'),
        ('PARECER_FAVORAVEL', 'Parecer Favorável'),
        ('PARECER_CONTRARIO', 'Parecer Contrário'),
        ('EMENDADA', 'Emendada'),
        ('APROVADA_COMISSAO', 'Aprovada em Comissão'),
        ('REJEITADA_COMISSAO', 'Rejeitada em Comissão'),
        ('PLENARIO', 'Encaminhada ao Plenário'),
        ('APROVADA_PLENARIO', 'Aprovada no Plenário'),
        ('REJEITADA_PLENARIO', 'Rejeitada no Plenário'),
        ('SANCIONADA', 'Sancionada'),
        ('VETADA', 'Vetada'),
        ('PROMULGADA', 'Promulgada'),
    ]
    
    proposicao = models.ForeignKey(Proposicao, on_delete=models.CASCADE, related_name='tramitacoes')
    data_movimentacao = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES)
    orgao = models.CharField(max_length=200, help_text="Órgão/Comissão responsável")
    relator = models.CharField(max_length=200, blank=True)
    
    # Detalhes
    observacoes = models.TextField(blank=True)
    prazo_analise = models.DateField(null=True, blank=True)
    numero_parecer = models.CharField(max_length=50, blank=True)
    
    # Documentos
    documento_tramitacao = models.FileField(
        upload_to='proposicoes/tramitacao/%Y/%m/', 
        blank=True,
        help_text="Documento oficial da tramitação"
    )
    
    # Auditoria
    registrado_em = models.DateTimeField(auto_now_add=True)
    registrado_por = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        verbose_name = "Tramitação da Proposição"
        verbose_name_plural = "Tramitações das Proposições"
        ordering = ['-data_movimentacao']
    
    def __str__(self):
        return f"{self.proposicao} - {self.get_status_display()}"
    
    @property
    def em_prazo(self):
        """Verifica se a tramitação está dentro do prazo"""
        if self.prazo_analise:
            return timezone.now().date() <= self.prazo_analise
        return True


class CoautorProposicao(models.Model):
    """Coautores das proposições"""
    proposicao = models.ForeignKey(Proposicao, on_delete=models.CASCADE, related_name='coautores')
    nome = models.CharField(max_length=200)
    cargo = models.CharField(max_length=100, blank=True)
    partido = models.CharField(max_length=50, blank=True)
    uf = models.CharField(max_length=2, blank=True)
    
    # Status
    confirmado = models.BooleanField(default=False)
    data_confirmacao = models.DateTimeField(null=True, blank=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        verbose_name = "Coautor da Proposição"
        verbose_name_plural = "Coautores das Proposições"
        ordering = ['nome']
        unique_together = ['proposicao', 'nome']
    
    def __str__(self):
        return f"{self.nome} - {self.proposicao}"


class HistoricoProposicao(models.Model):
    """Histórico de alterações nas proposições"""
    proposicao = models.ForeignKey(Proposicao, on_delete=models.CASCADE, related_name='historico')
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    acao = models.CharField(max_length=50)
    descricao = models.TextField()
    
    # Dados da alteração
    campo_alterado = models.CharField(max_length=100, blank=True)
    valor_anterior = models.TextField(blank=True)
    valor_novo = models.TextField(blank=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Histórico da Proposição"
        verbose_name_plural = "Históricos das Proposições"
        ordering = ['-criado_em']
    
    def __str__(self):
        return f"{self.proposicao} - {self.acao}"


class ModeloProposicao(models.Model):
    """Modelos/templates para proposições"""
    nome = models.CharField(max_length=100)
    tipo_proposicao = models.ForeignKey(TipoProposicao, on_delete=models.CASCADE)
    descricao = models.TextField(blank=True)
    
    # Template
    template_titulo = models.CharField(max_length=200, blank=True)
    template_ementa = models.TextField(blank=True)
    template_justificativa = models.TextField(blank=True)
    template_texto = models.TextField(blank=True)
    
    # Configurações
    ativo = models.BooleanField(default=True)
    publico = models.BooleanField(default=False, help_text="Disponível para outros gabinetes")
    
    # Auditoria
    gabinete = models.ForeignKey(Gabinete, on_delete=models.CASCADE)
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        verbose_name = "Modelo de Proposição"
        verbose_name_plural = "Modelos de Proposições"
        ordering = ['nome']
    
    def __str__(self):
        return f"{self.nome} ({self.tipo_proposicao})"