from django import forms
from django.utils import timezone
from .models import Atendimento
from crm.models import Pessoa


class AtendimentoForm(forms.ModelForm):
    """Formulário para criação/edição de atendimentos"""
    
    class Meta:
        model = Atendimento
        fields = [
            'pessoa', 'assunto', 'descricao', 'prioridade', 
            'origem', 'responsavel', 'prazo', 'observacoes'
        ]
        widgets = {
            'pessoa': forms.Select(attrs={
                'class': 'form-select'
            }),
            'assunto': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Assunto do atendimento'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Descrição detalhada do atendimento'
            }),
            'prioridade': forms.Select(attrs={
                'class': 'form-select'
            }),
            'origem': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Como chegou ao gabinete'
            }),
            'responsavel': forms.Select(attrs={
                'class': 'form-select'
            }),
            'prazo': forms.DateInput(attrs={
                'class': 'form-control',
                'type': 'date'
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
        
        if self.user:
            # Filtrar pessoas apenas do gabinete do usuário
            self.fields['pessoa'].queryset = Pessoa.objects.filter(
                gabinete=self.user.gabinete
            ).order_by('nome')
            
            # Filtrar responsáveis apenas do gabinete do usuário
            self.fields['responsavel'].queryset = self.user.gabinete.usuarios.filter(
                ativo=True
            ).order_by('first_name', 'last_name')
            
            # Definir gabinete automaticamente
            self.fields['gabinete'] = forms.ModelChoiceField(
                queryset=self.user.gabinete.__class__.objects.filter(id=self.user.gabinete.id),
                initial=self.user.gabinete,
                widget=forms.HiddenInput()
            )

    def clean_prazo(self):
        prazo = self.cleaned_data.get('prazo')
        if prazo and prazo < timezone.now().date():
            raise forms.ValidationError('O prazo não pode ser anterior à data atual.')
        return prazo


class AtendimentoStatusForm(forms.ModelForm):
    """Formulário para alteração de status do atendimento"""
    
    class Meta:
        model = Atendimento
        fields = ['status', 'satisfacao', 'observacoes']
        widgets = {
            'status': forms.Select(attrs={
                'class': 'form-select'
            }),
            'satisfacao': forms.Select(attrs={
                'class': 'form-select'
            }),
            'observacoes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Observações sobre a resolução'
            }),
        }


class AtendimentoSearchForm(forms.Form):
    """Formulário de busca para atendimentos"""
    q = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Buscar por protocolo, assunto, pessoa...'
        })
    )
    status = forms.ChoiceField(
        required=False,
        choices=[('', 'Todos os status')] + Atendimento.STATUS_CHOICES,
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    prioridade = forms.ChoiceField(
        required=False,
        choices=[('', 'Todas as prioridades')] + Atendimento.PRIORIDADE_CHOICES,
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    responsavel = forms.ModelChoiceField(
        required=False,
        queryset=None,
        empty_label='Todos os responsáveis',
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        
        if self.user:
            self.fields['responsavel'].queryset = self.user.gabinete.usuarios.filter(
                ativo=True
            ).order_by('first_name', 'last_name')









