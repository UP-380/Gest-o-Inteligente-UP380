from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from accounts.models import Gabinete
from atendimento.models import Atendimento
from documentos.models import Oficio, Memorando
from agenda.models import Evento

# Usar settings.AUTH_USER_MODEL ao invés de importar User diretamente
User = settings.AUTH_USER_MODEL


class TipoWorkflow(models.Model):
    """Tipos de workflow disponíveis no sistema"""
    TIPOS_CHOICES = [
        ('ATENDIMENTO_CIDADAO', 'Atendimento ao Cidadão'),
        ('ELABORACAO_OFICIO', 'Elaboração de Ofício'),
        ('PROPOSICAO_LEGISLATIVA', 'Proposição Legislativa'),
        ('AUDIENCIA_PUBLICA', 'Audiência Pública'),
        ('FISCALIZACAO', 'Fiscalização'),
        ('ARTICULACAO_POLITICA', 'Articulação Política'),
        ('PRESTACAO_CONTAS', 'Prestação de Contas'),
    ]
    
    nome = models.CharField(max_length=100)
    tipo = models.CharField(max_length=30, choices=TIPOS_CHOICES)
    descricao = models.TextField()
    ativo = models.BooleanField(default=True)
    prazo_padrao_dias = models.IntegerField(default=15)
    
    # Configurações de automação
    auto_atribuir = models.BooleanField(default=False, help_text="Atribuir automaticamente baseado em regras")
    notificar_prazo = models.BooleanField(default=True, help_text="Notificar quando próximo do prazo")
    dias_alerta_prazo = models.IntegerField(default=3, help_text="Dias antes do prazo para alertar")
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Tipo de Workflow"
        verbose_name_plural = "Tipos de Workflow"
        ordering = ['nome']
    
    def __str__(self):
        return self.nome


class EtapaWorkflow(models.Model):
    """Etapas de um workflow"""
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('EM_ANDAMENTO', 'Em Andamento'),
        ('CONCLUIDA', 'Concluída'),
        ('CANCELADA', 'Cancelada'),
        ('BLOQUEADA', 'Bloqueada'),
    ]
    
    tipo_workflow = models.ForeignKey(TipoWorkflow, on_delete=models.CASCADE, related_name='etapas')
    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True)
    ordem = models.IntegerField(default=1)
    obrigatoria = models.BooleanField(default=True)
    prazo_dias = models.IntegerField(default=5, help_text="Prazo em dias para esta etapa")
    
    # Responsabilidade
    papel_responsavel = models.CharField(max_length=50, blank=True, help_text="Papel/função responsável")
    usuario_responsavel = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Automação
    auto_iniciar = models.BooleanField(default=False, help_text="Iniciar automaticamente quando etapa anterior concluir")
    requer_aprovacao = models.BooleanField(default=False)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Etapa de Workflow"
        verbose_name_plural = "Etapas de Workflow"
        ordering = ['tipo_workflow', 'ordem']
        unique_together = ['tipo_workflow', 'ordem']
    
    def __str__(self):
        return f"{self.tipo_workflow.nome} - {self.nome}"


class ProcessoWorkflow(models.Model):
    """Instância de um processo de workflow"""
    STATUS_CHOICES = [
        ('INICIADO', 'Iniciado'),
        ('EM_ANDAMENTO', 'Em Andamento'),
        ('CONCLUIDO', 'Concluído'),
        ('CANCELADO', 'Cancelado'),
        ('SUSPENSO', 'Suspenso'),
    ]
    
    PRIORIDADE_CHOICES = [
        ('BAIXA', 'Baixa'),
        ('NORMAL', 'Normal'),
        ('ALTA', 'Alta'),
        ('URGENTE', 'Urgente'),
    ]
    
    gabinete = models.ForeignKey(Gabinete, on_delete=models.CASCADE)
    tipo_workflow = models.ForeignKey(TipoWorkflow, on_delete=models.CASCADE)
    titulo = models.CharField(max_length=200)
    descricao = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='INICIADO')
    prioridade = models.CharField(max_length=10, choices=PRIORIDADE_CHOICES, default='NORMAL')
    
    # Relacionamentos com outros objetos
    atendimento = models.ForeignKey(Atendimento, on_delete=models.CASCADE, null=True, blank=True)
    oficio = models.ForeignKey(Oficio, on_delete=models.CASCADE, null=True, blank=True)
    memorando = models.ForeignKey(Memorando, on_delete=models.CASCADE, null=True, blank=True)
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, null=True, blank=True)
    
    # Responsabilidade
    responsavel_atual = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    criado_por = models.ForeignKey(User, on_delete=models.CASCADE, related_name='processos_criados')
    
    # Prazos
    prazo_final = models.DateTimeField()
    data_inicio = models.DateTimeField(auto_now_add=True)
    data_conclusao = models.DateTimeField(null=True, blank=True)
    
    # Métricas
    tempo_total_horas = models.IntegerField(null=True, blank=True)
    etapas_concluidas = models.IntegerField(default=0)
    etapas_total = models.IntegerField(default=0)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Processo de Workflow"
        verbose_name_plural = "Processos de Workflow"
        ordering = ['-criado_em']
    
    def __str__(self):
        return f"{self.titulo} ({self.get_status_display()})"
    
    @property
    def percentual_conclusao(self):
        """Calcula o percentual de conclusão do processo"""
        if self.etapas_total == 0:
            return 0
        return round((self.etapas_concluidas / self.etapas_total) * 100, 1)
    
    @property
    def dias_restantes(self):
        """Calcula quantos dias restam para o prazo"""
        if self.status in ['CONCLUIDO', 'CANCELADO']:
            return 0
        
        agora = timezone.now()
        if self.prazo_final > agora:
            delta = self.prazo_final - agora
            return delta.days
        return 0
    
    @property
    def em_atraso(self):
        """Verifica se o processo está em atraso"""
        return timezone.now() > self.prazo_final and self.status not in ['CONCLUIDO', 'CANCELADO']
    
    def calcular_metricas(self):
        """Calcula métricas do processo"""
        execucoes = self.execucoes_etapas.all()
        self.etapas_total = execucoes.count()
        self.etapas_concluidas = execucoes.filter(status='CONCLUIDA').count()
        
        if self.status == 'CONCLUIDO' and self.data_conclusao:
            delta = self.data_conclusao - self.data_inicio
            self.tempo_total_horas = int(delta.total_seconds() / 3600)
        
        self.save()


class ExecucaoEtapa(models.Model):
    """Execução de uma etapa específica em um processo"""
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('EM_ANDAMENTO', 'Em Andamento'),
        ('CONCLUIDA', 'Concluída'),
        ('CANCELADA', 'Cancelada'),
        ('BLOQUEADA', 'Bloqueada'),
    ]
    
    processo = models.ForeignKey(ProcessoWorkflow, on_delete=models.CASCADE, related_name='execucoes_etapas')
    etapa = models.ForeignKey(EtapaWorkflow, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDENTE')
    
    # Responsabilidade
    responsavel = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Prazos
    prazo = models.DateTimeField()
    data_inicio = models.DateTimeField(null=True, blank=True)
    data_conclusao = models.DateTimeField(null=True, blank=True)
    
    # Observações e resultados
    observacoes = models.TextField(blank=True)
    resultado = models.TextField(blank=True)
    arquivos = models.JSONField(default=list, blank=True)  # Lista de caminhos de arquivos
    
    # Aprovação
    aprovado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='aprovacoes_etapa')
    data_aprovacao = models.DateTimeField(null=True, blank=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Execução de Etapa"
        verbose_name_plural = "Execuções de Etapas"
        ordering = ['processo', 'etapa__ordem']
        unique_together = ['processo', 'etapa']
    
    def __str__(self):
        return f"{self.processo.titulo} - {self.etapa.nome}"
    
    @property
    def em_atraso(self):
        """Verifica se a etapa está em atraso"""
        return timezone.now() > self.prazo and self.status not in ['CONCLUIDA', 'CANCELADA']
    
    @property
    def tempo_execucao_horas(self):
        """Calcula o tempo de execução em horas"""
        if self.data_inicio and self.data_conclusao:
            delta = self.data_conclusao - self.data_inicio
            return round(delta.total_seconds() / 3600, 1)
        return None
    
    def iniciar(self, usuario=None):
        """Inicia a execução da etapa"""
        if self.status == 'PENDENTE':
            self.status = 'EM_ANDAMENTO'
            self.data_inicio = timezone.now()
            if usuario:
                self.responsavel = usuario
            self.save()
    
    def concluir(self, resultado="", usuario=None):
        """Conclui a execução da etapa"""
        if self.status == 'EM_ANDAMENTO':
            self.status = 'CONCLUIDA'
            self.data_conclusao = timezone.now()
            self.resultado = resultado
            if usuario and self.etapa.requer_aprovacao:
                self.aprovado_por = usuario
                self.data_aprovacao = timezone.now()
            self.save()
            
            # Atualizar métricas do processo
            self.processo.calcular_metricas()
            
            # Verificar se deve iniciar próxima etapa automaticamente
            self._iniciar_proxima_etapa()
    
    def _iniciar_proxima_etapa(self):
        """Inicia automaticamente a próxima etapa se configurado"""
        proxima_etapa = EtapaWorkflow.objects.filter(
            tipo_workflow=self.etapa.tipo_workflow,
            ordem=self.etapa.ordem + 1,
            auto_iniciar=True
        ).first()
        
        if proxima_etapa:
            proxima_execucao = ExecucaoEtapa.objects.filter(
                processo=self.processo,
                etapa=proxima_etapa
            ).first()
            
            if proxima_execucao and proxima_execucao.status == 'PENDENTE':
                proxima_execucao.iniciar()


class RegrasAutomacao(models.Model):
    """Regras para automação de workflows"""
    CONDICOES_CHOICES = [
        ('TIPO_ATENDIMENTO', 'Tipo de Atendimento'),
        ('PRIORIDADE', 'Prioridade'),
        ('ORIGEM', 'Origem da Demanda'),
        ('ASSUNTO', 'Assunto Contém'),
        ('VALOR', 'Valor Monetário'),
        ('PRAZO', 'Prazo Solicitado'),
    ]
    
    ACOES_CHOICES = [
        ('ATRIBUIR_USUARIO', 'Atribuir a Usuário'),
        ('DEFINIR_PRIORIDADE', 'Definir Prioridade'),
        ('CRIAR_WORKFLOW', 'Criar Workflow'),
        ('ENVIAR_NOTIFICACAO', 'Enviar Notificação'),
        ('AGENDAR_EVENTO', 'Agendar Evento'),
    ]
    
    gabinete = models.ForeignKey(Gabinete, on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    descricao = models.TextField()
    ativa = models.BooleanField(default=True)
    
    # Condições
    condicao_tipo = models.CharField(max_length=30, choices=CONDICOES_CHOICES)
    condicao_valor = models.CharField(max_length=200)
    condicao_operador = models.CharField(max_length=20, default='IGUAL')  # IGUAL, CONTEM, MAIOR, MENOR
    
    # Ações
    acao_tipo = models.CharField(max_length=30, choices=ACOES_CHOICES)
    acao_valor = models.CharField(max_length=200)
    
    # Configurações
    tipo_workflow_alvo = models.ForeignKey(TipoWorkflow, on_delete=models.CASCADE, null=True, blank=True)
    usuario_alvo = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Regra de Automação"
        verbose_name_plural = "Regras de Automação"
        ordering = ['nome']
    
    def __str__(self):
        return self.nome
    
    def avaliar_condicao(self, objeto):
        """Avalia se a condição da regra é atendida pelo objeto"""
        # Implementar lógica de avaliação baseada no tipo de condição
        # Esta é uma versão simplificada
        if hasattr(objeto, self.condicao_tipo.lower()):
            valor_objeto = getattr(objeto, self.condicao_tipo.lower())
            
            if self.condicao_operador == 'IGUAL':
                return str(valor_objeto) == self.condicao_valor
            elif self.condicao_operador == 'CONTEM':
                return self.condicao_valor.lower() in str(valor_objeto).lower()
            
        return False
    
    def executar_acao(self, objeto):
        """Executa a ação definida na regra"""
        if self.acao_tipo == 'CRIAR_WORKFLOW' and self.tipo_workflow_alvo:
            # Criar processo de workflow
            processo = ProcessoWorkflow.objects.create(
                gabinete=objeto.gabinete,
                tipo_workflow=self.tipo_workflow_alvo,
                titulo=f"Workflow automático - {objeto}",
                descricao=f"Processo criado automaticamente pela regra: {self.nome}",
                prazo_final=timezone.now() + timedelta(days=self.tipo_workflow_alvo.prazo_padrao_dias),
                criado_por=objeto.criado_por if hasattr(objeto, 'criado_por') else None
            )
            
            # Criar execuções das etapas
            for etapa in self.tipo_workflow_alvo.etapas.all():
                ExecucaoEtapa.objects.create(
                    processo=processo,
                    etapa=etapa,
                    prazo=timezone.now() + timedelta(days=etapa.prazo_dias),
                    responsavel=etapa.usuario_responsavel
                )
            
            return processo
        
        return None


class HistoricoWorkflow(models.Model):
    """Histórico de mudanças nos workflows"""
    processo = models.ForeignKey(ProcessoWorkflow, on_delete=models.CASCADE, related_name='historico')
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    acao = models.CharField(max_length=100)
    descricao = models.TextField()
    dados_anteriores = models.JSONField(default=dict, blank=True)
    dados_novos = models.JSONField(default=dict, blank=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Histórico de Workflow"
        verbose_name_plural = "Históricos de Workflow"
        ordering = ['-criado_em']
    
    def __str__(self):
        return f"{self.processo.titulo} - {self.acao}"


class Tarefa(models.Model):
    """
    Tarefas simples para Kanban Board
    Sistema mais leve que o workflow completo, ideal para tarefas rápidas
    """
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('EM_ANDAMENTO', 'Em Andamento'),
        ('CONCLUIDA', 'Concluída'),
        ('CANCELADA', 'Cancelada'),
    ]
    
    PRIORIDADE_CHOICES = [
        (1, 'Baixa'),
        (2, 'Normal'),
        (3, 'Alta'),
        (4, 'Urgente'),
        (5, 'Crítica'),
    ]
    
    TIPO_CHOICES = [
        ('MANUAL', 'Criada Manualmente'),
        ('ATENDIMENTO', 'Gerada por Atendimento'),
        ('DOCUMENTO', 'Gerada por Documento'),
        ('EVENTO', 'Gerada por Evento'),
        ('PROCESSO', 'Gerada por Processo'),
    ]
    
    # Informações Básicas
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='tarefas',
        verbose_name='Gabinete'
    )
    titulo = models.CharField(max_length=200, verbose_name='Título')
    descricao = models.TextField(blank=True, verbose_name='Descrição')
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default='MANUAL',
        verbose_name='Tipo de Tarefa'
    )
    
    # Classificação
    categoria = models.ForeignKey(
        'accounts.Assunto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tarefas',
        verbose_name='Categoria'
    )
    tags = models.CharField(max_length=200, blank=True, verbose_name='Tags')
    
    # Status e Prioridade
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDENTE',
        verbose_name='Status'
    )
    prioridade = models.IntegerField(
        choices=PRIORIDADE_CHOICES,
        default=2,
        verbose_name='Prioridade'
    )
    
    # Responsabilidade
    responsavel = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tarefas_responsavel',
        verbose_name='Responsável'
    )
    equipe = models.ManyToManyField(
        User,
        blank=True,
        related_name='tarefas_equipe',
        verbose_name='Equipe Envolvida'
    )
    
    # Prazos
    prazo = models.DateTimeField(null=True, blank=True, verbose_name='Prazo')
    data_inicio = models.DateTimeField(null=True, blank=True, verbose_name='Data de Início')
    data_conclusao = models.DateTimeField(null=True, blank=True, verbose_name='Data de Conclusão')
    
    # Vinculações/Rastreabilidade
    atendimento = models.ForeignKey(
        Atendimento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tarefas',
        verbose_name='Atendimento Relacionado'
    )
    processo_workflow = models.ForeignKey(
        ProcessoWorkflow,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tarefas',
        verbose_name='Processo Relacionado'
    )
    evento = models.ForeignKey(
        Evento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tarefas',
        verbose_name='Evento Relacionado'
    )
    
    # Informações Adicionais
    observacoes = models.TextField(blank=True, verbose_name='Observações')
    resultado = models.TextField(blank=True, verbose_name='Resultado/Conclusão')
    arquivos_anexos = models.JSONField(default=list, blank=True, verbose_name='Arquivos Anexos')
    
    # Métricas
    tempo_estimado_horas = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Tempo Estimado (horas)'
    )
    tempo_gasto_horas = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Tempo Gasto (horas)'
    )
    
    # Controle
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    criado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tarefas_criadas',
        verbose_name='Criado por'
    )
    concluido_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tarefas_concluidas',
        verbose_name='Concluído por'
    )
    
    class Meta:
        verbose_name = 'Tarefa'
        verbose_name_plural = 'Tarefas'
        ordering = ['-prioridade', 'prazo', '-criado_em']
        indexes = [
            models.Index(fields=['status', 'gabinete']),
            models.Index(fields=['responsavel', 'status']),
            models.Index(fields=['prazo']),
        ]
    
    def __str__(self):
        return f"#{self.id} - {self.titulo}"
    
    def save(self, *args, **kwargs):
        # Se status mudou para EM_ANDAMENTO e não tem data_inicio
        if self.status == 'EM_ANDAMENTO' and not self.data_inicio:
            self.data_inicio = timezone.now()
        
        # Se status mudou para CONCLUIDA e não tem data_conclusao
        if self.status == 'CONCLUIDA' and not self.data_conclusao:
            self.data_conclusao = timezone.now()
        elif self.status != 'CONCLUIDA':
            self.data_conclusao = None
            self.concluido_por = None
        
        super().save(*args, **kwargs)
    
    @property
    def atrasada(self):
        """Verifica se a tarefa está atrasada"""
        if self.prazo and self.status not in ['CONCLUIDA', 'CANCELADA']:
            return timezone.now() > self.prazo
        return False
    
    @property
    def dias_restantes(self):
        """Retorna quantos dias faltam para o prazo"""
        if self.prazo and self.status not in ['CONCLUIDA', 'CANCELADA']:
            delta = self.prazo - timezone.now()
            return delta.days
        return None
    
    @property
    def tempo_execucao(self):
        """Calcula o tempo de execução"""
        if self.data_inicio and self.data_conclusao:
            delta = self.data_conclusao - self.data_inicio
            return round(delta.total_seconds() / 3600, 2)  # retorna em horas
        return None
    
    @property
    def cor_prioridade(self):
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
    def cor_status(self):
        """Retorna a cor baseada no status"""
        cores = {
            'PENDENTE': '#6c757d',     # Cinza
            'EM_ANDAMENTO': '#007bff',  # Azul
            'CONCLUIDA': '#28a745',     # Verde
            'CANCELADA': '#dc3545',     # Vermelho
        }
        return cores.get(self.status, '#6c757d')
    
    def iniciar(self, usuario=None):
        """Inicia a tarefa"""
        if self.status == 'PENDENTE':
            self.status = 'EM_ANDAMENTO'
            self.data_inicio = timezone.now()
            if usuario and not self.responsavel:
                self.responsavel = usuario
            self.save()
    
    def concluir(self, resultado="", usuario=None):
        """Conclui a tarefa"""
        if self.status in ['PENDENTE', 'EM_ANDAMENTO']:
            self.status = 'CONCLUIDA'
            self.data_conclusao = timezone.now()
            self.resultado = resultado
            if usuario:
                self.concluido_por = usuario
            self.save()
    
    def cancelar(self, motivo=""):
        """Cancela a tarefa"""
        if self.status not in ['CONCLUIDA', 'CANCELADA']:
            self.status = 'CANCELADA'
            if motivo:
                self.observacoes += f"\n[CANCELADO] {motivo}"
            self.save()
    
    def get_tags_list(self):
        """Retorna as tags como lista"""
        if self.tags:
            return [tag.strip() for tag in self.tags.split(',') if tag.strip()]
        return []