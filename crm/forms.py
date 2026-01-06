from django import forms
from .models import Pessoa


class PessoaForm(forms.ModelForm):
    """Formulário para criação/edição de pessoas"""
    
    class Meta:
        model = Pessoa
        fields = [
            'gabinete', 'nome', 'tipo', 'cpf', 'email', 'telefone', 
            'bairro', 'zona_eleitoral', 'consentiu_contato',
            'origem', 'tags', 'observacoes'
        ]
        widgets = {
            'gabinete': forms.HiddenInput(),
            'nome': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Nome completo'
            }),
            'tipo': forms.Select(attrs={
                'class': 'form-select'
            }),
            'cpf': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '000.000.000-00'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'email@exemplo.com'
            }),
            'telefone': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '(00) 00000-0000'
            }),
            'bairro': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Nome do bairro'
            }),
            'zona_eleitoral': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Zona eleitoral'
            }),
            'consentiu_contato': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'origem': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Como conheceu o gabinete'
            }),
            'tags': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'tag1, tag2, tag3'
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
        
        # Se é uma nova pessoa, definir o gabinete automaticamente
        if not self.instance.pk and self.user:
            self.fields['gabinete'].initial = self.user.gabinete
            self.fields['gabinete'].queryset = self.user.gabinete.__class__.objects.filter(id=self.user.gabinete.id)

    def clean_cpf(self):
        cpf = self.cleaned_data.get('cpf')
        if cpf:
            # Remove caracteres não numéricos
            cpf = ''.join(filter(str.isdigit, cpf))
            if len(cpf) != 11:
                raise forms.ValidationError('CPF deve ter 11 dígitos.')
        return cpf

    def clean_telefone(self):
        telefone = self.cleaned_data.get('telefone')
        if telefone:
            # Remove caracteres não numéricos
            telefone = ''.join(filter(str.isdigit, telefone))
            if len(telefone) < 10:
                raise forms.ValidationError('Telefone deve ter pelo menos 10 dígitos.')
        return telefone


class PessoaSearchForm(forms.Form):
    """Formulário de busca para pessoas"""
    q = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Buscar por nome, email, telefone...'
        })
    )
    tipo = forms.ChoiceField(
        required=False,
        choices=[('', 'Todos os tipos')] + Pessoa.TIPO_CHOICES,
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    consentiu_contato = forms.ChoiceField(
        required=False,
        choices=[
            ('', 'Todos'),
            ('True', 'Consentiu'),
            ('False', 'Não consentiu')
        ],
        widget=forms.Select(attrs={'class': 'form-select'})
    )


