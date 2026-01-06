from django import forms
from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import Oficio, Memorando, Destinatario, Requerimento, Indicacao, TipoOrgao
from crm.models import Pessoa
from accounts.models import Assunto, JustificativaPadrao, SolicitacaoPadrao

User = get_user_model()


class TipoOrgaoForm(forms.ModelForm):
    """Formulário para gerenciar tipos de órgão"""
    
    class Meta:
        model = TipoOrgao
        fields = ['nome', 'descricao', 'ordem', 'ativo']
        widgets = {
            'nome': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ex: Prefeitura, Secretaria, Ministério'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'Descrição do tipo de órgão'
            }),
            'ordem': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': '0',
                'placeholder': 'Ordem de exibição'
            }),
            'ativo': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }


class DestinatarioForm(forms.ModelForm):
    """Formulário para criação/edição de destinatários padrões"""
    
    class Meta:
        model = Destinatario
        fields = [
            'nome', 'cargo', 'orgao', 'tipo_orgao', 'nivel_administrativo',
            'email', 'telefone', 'municipio', 'uf', 'endereco', 
            'observacoes', 'ativo'
        ]
        widgets = {
            'nome': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Nome completo do destinatário'
            }),
            'cargo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ex: Secretário, Diretor, Prefeito'
            }),
            'orgao': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ex: Secretaria Municipal de Obras'
            }),
            'tipo_orgao': forms.Select(attrs={
                'class': 'form-select'
            }),
            'nivel_administrativo': forms.Select(attrs={
                'class': 'form-select'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'email.institucional@orgao.gov.br'
            }),
            'telefone': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '(00) 00000-0000'
            }),
            'municipio': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Nome do município',
                'id': 'id_municipio'
            }),
            'uf': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'SP',
                'maxlength': '2',
                'id': 'id_uf',
                'style': 'text-transform: uppercase;'
            }),
            'endereco': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Endereço completo (opcional)'
            }),
            'observacoes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'Ex: Solicitar protocolo ao enviar ofício'
            }),
            'ativo': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Adicionar empty_label para tipo_orgao
        self.fields['tipo_orgao'].empty_label = "Selecione o tipo de órgão"
        self.fields['tipo_orgao'].queryset = TipoOrgao.objects.filter(ativo=True).order_by('ordem', 'nome')
    
    def clean_uf(self):
        """Valida e formata UF"""
        uf = self.cleaned_data.get('uf', '')
        return uf.upper()
    
    def clean_email(self):
        """Valida email institucional"""
        email = self.cleaned_data.get('email', '')
        if email and not ('@' in email and '.' in email):
            raise forms.ValidationError('Digite um e-mail válido.')
        return email.lower()


class DocumentoBaseForm(forms.ModelForm):
    """Formulário base para documentos"""
    
    class Meta:
        fields = [
            'data', 'corpo', 'categoria', 'destinatario', 
            'pessoa_interessada', 'responsavel', 'status',
            'arquivo', 'observacoes'
        ]
        widgets = {
            'data': forms.DateInput(attrs={
                'class': 'form-control',
                'type': 'date'
            }),
            'corpo': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 10,
                'placeholder': 'Conteúdo do documento'
            }),
            'categoria': forms.Select(attrs={
                'class': 'form-select'
            }),
            'destinatario': forms.Select(attrs={
                'class': 'form-select'
            }),
            'pessoa_interessada': forms.Select(attrs={
                'class': 'form-select'
            }),
            'responsavel': forms.Select(attrs={
                'class': 'form-select'
            }),
            'status': forms.Select(attrs={
                'class': 'form-select'
            }),
            'arquivo': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': '.pdf,.doc,.docx'
            }),
            'observacoes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Observações adicionais'
            }),
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        
        if self.user and self.user.gabinete:
            # Filtrar destinatários ativos
            self.fields['destinatario'].queryset = Destinatario.objects.filter(
                ativo=True
            ).order_by('nome')
            
            # Filtrar pessoas do CRM do gabinete
            from crm.models import Pessoa
            self.fields['pessoa_interessada'].queryset = Pessoa.objects.filter(
                gabinete=self.user.gabinete
            ).order_by('nome')
            self.fields['pessoa_interessada'].empty_label = "Selecione uma pessoa"
            
            # Filtrar assuntos/categorias do gabinete
            from accounts.models import Assunto
            self.fields['categoria'].queryset = Assunto.objects.filter(
                gabinete=self.user.gabinete
            ).order_by('nome')
            self.fields['categoria'].empty_label = "Selecione um assunto"
            
            # Filtrar usuários do sistema (excluir visitantes)
            self.fields['responsavel'].queryset = User.objects.filter(
                gabinete=self.user.gabinete
            ).exclude(
                papel='VISITANTE'
            ).order_by('first_name', 'last_name')
            self.fields['responsavel'].empty_label = "Selecione um responsável"
            
            # Definir gabinete automaticamente
            self.fields['gabinete'] = forms.ModelChoiceField(
                queryset=self.user.gabinete.__class__.objects.filter(id=self.user.gabinete.id),
                initial=self.user.gabinete,
                widget=forms.HiddenInput()
            )


class OficioForm(DocumentoBaseForm):
    """Formulário para ofícios"""
    
    class Meta(DocumentoBaseForm.Meta):
        model = Oficio
        fields = DocumentoBaseForm.Meta.fields + ['justificativa_padrao', 'solicitacao_padrao']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Adicionar widget para justificativa_padrao
        self.fields['justificativa_padrao'].widget = forms.Select(attrs={
            'class': 'form-select',
            'onchange': 'preencherJustificativa(this.value)'
        })
        
        # Adicionar widget para solicitacao_padrao
        self.fields['solicitacao_padrao'].widget = forms.Select(attrs={
            'class': 'form-select',
            'onchange': 'preencherSolicitacao(this.value)'
        })
        
        if self.user and self.user.gabinete:
            # Filtrar justificativas padrão do gabinete
            from accounts.models import JustificativaPadrao
            self.fields['justificativa_padrao'].queryset = JustificativaPadrao.objects.filter(
                gabinete=self.user.gabinete,
                ativo=True
            ).order_by('nome')
            self.fields['justificativa_padrao'].empty_label = "Selecione uma justificativa"
            
            # Filtrar solicitações padrão do gabinete
            self.fields['solicitacao_padrao'].queryset = SolicitacaoPadrao.objects.filter(
                gabinete=self.user.gabinete,
                ativo=True
            ).order_by('nome')
            self.fields['solicitacao_padrao'].empty_label = "Selecione uma solicitação"


class MemorandoForm(DocumentoBaseForm):
    """Formulário para memorandos"""
    
    class Meta(DocumentoBaseForm.Meta):
        model = Memorando


class DocumentoStatusForm(forms.ModelForm):
    """Formulário para alteração de status do documento"""
    
    class Meta:
        fields = ['status', 'observacoes']
        widgets = {
            'status': forms.Select(attrs={
                'class': 'form-select'
            }),
            'observacoes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Observações sobre a alteração de status'
            }),
        }


class DocumentoSearchForm(forms.Form):
    """Formulário de busca para documentos"""
    q = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Buscar por número, assunto, destinatário...'
        })
    )
    status = forms.ChoiceField(
        required=False,
        choices=[('', 'Todos os status')] + [('RASCUNHO', 'Rascunho'), ('ASSINADO', 'Assinado'), ('ENVIADO', 'Enviado')],
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    destinatario = forms.ModelChoiceField(
        required=False,
        queryset=Destinatario.objects.filter(ativo=True),
        empty_label='Todos os destinatários',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    data_inicio = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    data_fim = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )


class RequerimentoForm(DocumentoBaseForm):
    """Formulário para requerimentos"""
    
    class Meta(DocumentoBaseForm.Meta):
        model = Requerimento
        fields = DocumentoBaseForm.Meta.fields + [
            'tipo_requerimento', 'categoria', 'prioridade', 
            'prazo_resposta_dias', 'fundamentacao', 'atendimento'
        ]
        widgets = {
            **DocumentoBaseForm.Meta.widgets,
            'tipo_requerimento': forms.Select(attrs={
                'class': 'form-select'
            }),
            'categoria': forms.Select(attrs={
                'class': 'form-select'
            }),
            'prioridade': forms.Select(attrs={
                'class': 'form-select'
            }),
            'prazo_resposta_dias': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': '1',
                'placeholder': 'Dias'
            }),
            'fundamentacao': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Fundamentação legal do requerimento'
            }),
            'atendimento': forms.Select(attrs={
                'class': 'form-select'
            }),
        }


class IndicacaoForm(DocumentoBaseForm):
    """Formulário para indicações"""
    
    class Meta(DocumentoBaseForm.Meta):
        model = Indicacao
        fields = DocumentoBaseForm.Meta.fields + [
            'tipo_indicacao', 'categoria', 'prioridade', 'status_execucao',
            'municipio', 'bairro', 'endereco_referencia', 'valor_estimado',
            'justificativa', 'beneficiados_estimado', 'fundamentacao', 'atendimento'
        ]
        widgets = {
            **DocumentoBaseForm.Meta.widgets,
            'tipo_indicacao': forms.Select(attrs={
                'class': 'form-select'
            }),
            'categoria': forms.Select(attrs={
                'class': 'form-select'
            }),
            'prioridade': forms.Select(attrs={
                'class': 'form-select'
            }),
            'status_execucao': forms.Select(attrs={
                'class': 'form-select'
            }),
            'municipio': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Município'
            }),
            'bairro': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Bairro'
            }),
            'endereco_referencia': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'Endereço ou referência'
            }),
            'valor_estimado': forms.NumberInput(attrs={
                'class': 'form-control',
                'step': '0.01',
                'placeholder': 'R$ 0,00'
            }),
            'justificativa': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Justificativa da indicação'
            }),
            'beneficiados_estimado': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': '1',
                'placeholder': 'Número de pessoas'
            }),
            'fundamentacao': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Fundamentação legal'
            }),
            'atendimento': forms.Select(attrs={
                'class': 'form-select'
            }),
        }
