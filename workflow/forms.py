from django import forms
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta

User = get_user_model()

from .models import ProcessoWorkflow, ExecucaoEtapa, TipoWorkflow, RegrasAutomacao
from atendimento.models import Atendimento
from documentos.models import Oficio, Memorando
from agenda.models import Evento


class ProcessoWorkflowForm(forms.ModelForm):
    """Formulário para criação e edição de processos de workflow"""
    
    class Meta:
        model = ProcessoWorkflow
        fields = [
            'tipo_workflow', 'titulo', 'descricao', 'prioridade',
            'responsavel_atual', 'prazo_final', 'atendimento', 
            'oficio', 'memorando', 'evento'
        ]
        widgets = {
            'titulo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Digite o título do processo'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Descreva o processo detalhadamente'
            }),
            'tipo_workflow': forms.Select(attrs={
                'class': 'form-control'
            }),
            'prioridade': forms.Select(attrs={
                'class': 'form-control'
            }),
            'responsavel_atual': forms.Select(attrs={
                'class': 'form-control'
            }),
            'prazo_final': forms.DateTimeInput(attrs={
                'class': 'form-control',
                'type': 'datetime-local'
            }),
            'atendimento': forms.Select(attrs={
                'class': 'form-control'
            }),
            'oficio': forms.Select(attrs={
                'class': 'form-control'
            }),
            'memorando': forms.Select(attrs={
                'class': 'form-control'
            }),
            'evento': forms.Select(attrs={
                'class': 'form-control'
            }),
        }
        labels = {
            'tipo_workflow': 'Tipo de Workflow',
            'titulo': 'Título',
            'descricao': 'Descrição',
            'prioridade': 'Prioridade',
            'responsavel_atual': 'Responsável',
            'prazo_final': 'Prazo Final',
            'atendimento': 'Atendimento Relacionado',
            'oficio': 'Ofício Relacionado',
            'memorando': 'Memorando Relacionado',
            'evento': 'Evento Relacionado',
        }
    
    def __init__(self, *args, **kwargs):
        self.gabinete = kwargs.pop('gabinete', None)
        super().__init__(*args, **kwargs)
        
        if self.gabinete:
            # Filtrar tipos de workflow ativos
            self.fields['tipo_workflow'].queryset = TipoWorkflow.objects.filter(ativo=True)
            
            # Filtrar usuários do gabinete
            self.fields['responsavel_atual'].queryset = self.gabinete.usuarios.all()
            self.fields['responsavel_atual'].empty_label = "Selecione um responsável"
            
            # Filtrar relacionamentos por gabinete
            self.fields['atendimento'].queryset = Atendimento.objects.filter(
                gabinete=self.gabinete
            ).order_by('-criado_em')[:100]
            self.fields['atendimento'].empty_label = "Nenhum atendimento"
            
            self.fields['oficio'].queryset = Oficio.objects.filter(
                gabinete=self.gabinete
            ).order_by('-criado_em')[:100]
            self.fields['oficio'].empty_label = "Nenhum ofício"
            
            self.fields['memorando'].queryset = Memorando.objects.filter(
                gabinete=self.gabinete
            ).order_by('-criado_em')[:100]
            self.fields['memorando'].empty_label = "Nenhum memorando"
            
            self.fields['evento'].queryset = Evento.objects.filter(
                gabinete=self.gabinete
            ).order_by('-data_inicio')[:100]
            self.fields['evento'].empty_label = "Nenhum evento"
        
        # Definir prazo padrão baseado no tipo de workflow
        if not self.instance.pk and 'tipo_workflow' in self.data:
            try:
                tipo_id = int(self.data['tipo_workflow'])
                tipo = TipoWorkflow.objects.get(id=tipo_id)
                prazo_padrao = timezone.now() + timedelta(days=tipo.prazo_padrao_dias)
                self.fields['prazo_final'].initial = prazo_padrao
            except (ValueError, TipoWorkflow.DoesNotExist):
                pass
    
    def clean_prazo_final(self):
        prazo_final = self.cleaned_data.get('prazo_final')
        
        if prazo_final and prazo_final <= timezone.now():
            raise forms.ValidationError("O prazo final deve ser uma data futura.")
        
        return prazo_final
    
    def clean(self):
        cleaned_data = super().clean()
        
        # Validar se pelo menos um relacionamento foi definido quando necessário
        tipo_workflow = cleaned_data.get('tipo_workflow')
        if tipo_workflow and tipo_workflow.tipo in ['ATENDIMENTO_CIDADAO', 'ELABORACAO_OFICIO']:
            atendimento = cleaned_data.get('atendimento')
            oficio = cleaned_data.get('oficio')
            
            if tipo_workflow.tipo == 'ATENDIMENTO_CIDADAO' and not atendimento:
                self.add_error('atendimento', 'Atendimento é obrigatório para este tipo de workflow.')
            
            if tipo_workflow.tipo == 'ELABORACAO_OFICIO' and not oficio:
                self.add_error('oficio', 'Ofício é obrigatório para este tipo de workflow.')
        
        return cleaned_data


class ExecucaoEtapaForm(forms.ModelForm):
    """Formulário para execução de etapas"""
    
    class Meta:
        model = ExecucaoEtapa
        fields = ['observacoes', 'resultado']
        widgets = {
            'observacoes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Observações sobre a execução da etapa'
            }),
            'resultado': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Descreva o resultado obtido nesta etapa'
            }),
        }
        labels = {
            'observacoes': 'Observações',
            'resultado': 'Resultado',
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Tornar resultado obrigatório para conclusão
        if self.instance and self.instance.etapa:
            if self.instance.etapa.requer_aprovacao:
                self.fields['resultado'].required = True
                self.fields['resultado'].help_text = "Resultado é obrigatório para etapas que requerem aprovação."


class FiltroProcessosForm(forms.Form):
    """Formulário para filtros na listagem de processos"""
    
    STATUS_CHOICES = [('', 'Todos os status')] + ProcessoWorkflow.STATUS_CHOICES
    PRIORIDADE_CHOICES = [('', 'Todas as prioridades')] + ProcessoWorkflow.PRIORIDADE_CHOICES
    
    status = forms.ChoiceField(
        choices=STATUS_CHOICES,
        required=False,
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    
    tipo_workflow = forms.ModelChoiceField(
        queryset=TipoWorkflow.objects.filter(ativo=True),
        required=False,
        empty_label="Todos os tipos",
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    
    prioridade = forms.ChoiceField(
        choices=PRIORIDADE_CHOICES,
        required=False,
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    
    responsavel = forms.ModelChoiceField(
        queryset=None,
        required=False,
        empty_label="Todos os responsáveis",
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    
    data_inicio = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        }),
        label='Data Início (a partir de)'
    )
    
    data_fim = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        }),
        label='Data Fim (até)'
    )
    
    search = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Buscar por título ou descrição'
        }),
        label='Buscar'
    )
    
    def __init__(self, *args, **kwargs):
        gabinete = kwargs.pop('gabinete', None)
        super().__init__(*args, **kwargs)
        
        # Inicializar queryset de responsavel
        if not self.fields['responsavel'].queryset:
            self.fields['responsavel'].queryset = User.objects.none()
        
        if gabinete:
            self.fields['responsavel'].queryset = gabinete.usuarios.all()


class RegrasAutomacaoForm(forms.ModelForm):
    """Formulário para regras de automação"""
    
    class Meta:
        model = RegrasAutomacao
        fields = [
            'nome', 'descricao', 'ativa', 'condicao_tipo', 
            'condicao_operador', 'condicao_valor', 'acao_tipo', 
            'acao_valor', 'tipo_workflow_alvo', 'usuario_alvo'
        ]
        widgets = {
            'nome': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Nome da regra'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Descrição da regra'
            }),
            'ativa': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'condicao_tipo': forms.Select(attrs={
                'class': 'form-control'
            }),
            'condicao_operador': forms.Select(attrs={
                'class': 'form-control'
            }),
            'condicao_valor': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Valor da condição'
            }),
            'acao_tipo': forms.Select(attrs={
                'class': 'form-control'
            }),
            'acao_valor': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Valor da ação'
            }),
            'tipo_workflow_alvo': forms.Select(attrs={
                'class': 'form-control'
            }),
            'usuario_alvo': forms.Select(attrs={
                'class': 'form-control'
            }),
        }
        labels = {
            'nome': 'Nome da Regra',
            'descricao': 'Descrição',
            'ativa': 'Regra Ativa',
            'condicao_tipo': 'Tipo de Condição',
            'condicao_operador': 'Operador',
            'condicao_valor': 'Valor da Condição',
            'acao_tipo': 'Tipo de Ação',
            'acao_valor': 'Valor da Ação',
            'tipo_workflow_alvo': 'Workflow Alvo',
            'usuario_alvo': 'Usuário Alvo',
        }
    
    OPERADOR_CHOICES = [
        ('IGUAL', 'Igual a'),
        ('CONTEM', 'Contém'),
        ('MAIOR', 'Maior que'),
        ('MENOR', 'Menor que'),
        ('DIFERENTE', 'Diferente de'),
    ]
    
    def __init__(self, *args, **kwargs):
        gabinete = kwargs.pop('gabinete', None)
        super().__init__(*args, **kwargs)
        
        # Adicionar choices para operador
        self.fields['condicao_operador'] = forms.ChoiceField(
            choices=self.OPERADOR_CHOICES,
            widget=forms.Select(attrs={'class': 'form-control'})
        )
        
        if gabinete:
            self.fields['tipo_workflow_alvo'].queryset = TipoWorkflow.objects.filter(ativo=True)
            self.fields['usuario_alvo'].queryset = gabinete.usuarios.all()
            self.fields['tipo_workflow_alvo'].empty_label = "Selecione um workflow"
            self.fields['usuario_alvo'].empty_label = "Selecione um usuário"
    
    def clean(self):
        cleaned_data = super().clean()
        acao_tipo = cleaned_data.get('acao_tipo')
        
        # Validações específicas por tipo de ação
        if acao_tipo == 'CRIAR_WORKFLOW':
            if not cleaned_data.get('tipo_workflow_alvo'):
                self.add_error('tipo_workflow_alvo', 'Workflow alvo é obrigatório para esta ação.')
        
        if acao_tipo == 'ATRIBUIR_USUARIO':
            if not cleaned_data.get('usuario_alvo'):
                self.add_error('usuario_alvo', 'Usuário alvo é obrigatório para esta ação.')
        
        return cleaned_data


class BuscaAvancadaForm(forms.Form):
    """Formulário para busca avançada de processos"""
    
    termo_busca = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Digite termos para buscar'
        }),
        label='Termo de Busca'
    )
    
    campos_busca = forms.MultipleChoiceField(
        choices=[
            ('titulo', 'Título'),
            ('descricao', 'Descrição'),
            ('observacoes_etapas', 'Observações das Etapas'),
            ('resultado_etapas', 'Resultados das Etapas'),
        ],
        widget=forms.CheckboxSelectMultiple(attrs={
            'class': 'form-check-input'
        }),
        required=False,
        initial=['titulo', 'descricao'],
        label='Buscar em'
    )
    
    periodo_inicio = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        }),
        label='Período - Início'
    )
    
    periodo_fim = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        }),
        label='Período - Fim'
    )
    
    incluir_concluidos = forms.BooleanField(
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        }),
        label='Incluir Processos Concluídos'
    )
    
    incluir_cancelados = forms.BooleanField(
        required=False,
        initial=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        }),
        label='Incluir Processos Cancelados'
    )
    
    def clean(self):
        cleaned_data = super().clean()
        periodo_inicio = cleaned_data.get('periodo_inicio')
        periodo_fim = cleaned_data.get('periodo_fim')
        
        if periodo_inicio and periodo_fim:
            if periodo_inicio > periodo_fim:
                raise forms.ValidationError("A data de início deve ser anterior à data de fim.")
        
        return cleaned_data


class TarefaForm(forms.ModelForm):
    """Formulário para criação e edição de tarefas"""
    
    class Meta:
        from .models import Tarefa as TarefaModel
        model = TarefaModel
        fields = [
            'titulo', 'descricao', 'categoria', 'tags', 'status', 'prioridade',
            'responsavel', 'prazo', 'atendimento', 'evento',
            'tempo_estimado_horas', 'observacoes'
        ]
        widgets = {
            'titulo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Título da tarefa'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Descrição detalhada'
            }),
            'categoria': forms.Select(attrs={
                'class': 'form-select'
            }),
            'tags': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Tag1, Tag2, Tag3'
            }),
            'status': forms.Select(attrs={
                'class': 'form-select'
            }),
            'prioridade': forms.Select(attrs={
                'class': 'form-select'
            }),
            'responsavel': forms.Select(attrs={
                'class': 'form-select'
            }),
            'prazo': forms.DateTimeInput(attrs={
                'class': 'form-control',
                'type': 'datetime-local'
            }),
            'atendimento': forms.Select(attrs={
                'class': 'form-select'
            }),
            'evento': forms.Select(attrs={
                'class': 'form-select'
            }),
            'tempo_estimado_horas': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': '0',
                'step': '0.5'
            }),
            'observacoes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Observações internas'
            }),
        }
    
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        
        if self.user and hasattr(self.user, 'gabinete'):
            gabinete = self.user.gabinete
            
            # Filtrar responsáveis
            self.fields['responsavel'].queryset = gabinete.usuarios.all()
            self.fields['responsavel'].empty_label = "Selecione um responsável"
            
            # Filtrar categorias
            from accounts.models import Assunto
            self.fields['categoria'].queryset = Assunto.objects.filter(
                Q(gabinete=gabinete) | Q(gabinete__isnull=True)
            ).order_by('nome')
            self.fields['categoria'].empty_label = "Selecione uma categoria"
            
            # Filtrar atendimentos
            self.fields['atendimento'].queryset = Atendimento.objects.filter(
                gabinete=gabinete
            ).order_by('-criado_em')[:100]
            self.fields['atendimento'].empty_label = "Sem vínculo"
            
            # Filtrar eventos
            self.fields['evento'].queryset = Evento.objects.filter(
                gabinete=gabinete
            ).order_by('-inicio')[:100]
            self.fields['evento'].empty_label = "Sem vínculo"