from django import forms
from django.contrib.auth import get_user_model
from .models import Gabinete, Assunto, ModeloDocumento, JustificativaPadrao, SolicitacaoPadrao

User = get_user_model()


class GabineteForm(forms.ModelForm):
    class Meta:
        model = Gabinete
        fields = [
            'nome', 'parlamentar_nome', 'cargo', 'esfera',
            'legislatura_inicio', 'legislatura_fim', 'numero_legislatura',
            'partido_sigla', 'partido_nome', 'partido_logo',
            'logo', 'cep', 'endereco', 'municipio', 'estado',
            'telefone', 'email', 'site',
            'ativo'
        ]
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'parlamentar_nome': forms.TextInput(attrs={'class': 'form-control'}),
            'cargo': forms.Select(attrs={'class': 'form-select'}),
            'esfera': forms.Select(attrs={'class': 'form-select'}),
            'legislatura_inicio': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'legislatura_fim': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'numero_legislatura': forms.TextInput(attrs={'class': 'form-control'}),
            'partido_sigla': forms.TextInput(attrs={'class': 'form-control'}),
            'partido_nome': forms.TextInput(attrs={'class': 'form-control'}),
            'partido_logo': forms.FileInput(attrs={'class': 'form-control'}),
            'logo': forms.FileInput(attrs={'class': 'form-control'}),
            'cep': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '00000-000'}),
            'endereco': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'municipio': forms.TextInput(attrs={'class': 'form-control'}),
            'estado': forms.TextInput(attrs={'class': 'form-control', 'maxlength': '2', 'placeholder': 'SP'}),
            'telefone': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'site': forms.URLInput(attrs={'class': 'form-control'}),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


class AssuntoForm(forms.ModelForm):
    class Meta:
        model = Assunto
        fields = ['nome', 'descricao', 'cor', 'icone', 'ordem', 'ativo']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nome do assunto'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 2, 'placeholder': 'Descrição do assunto'}),
            'cor': forms.TextInput(attrs={'class': 'form-control', 'type': 'color', 'placeholder': '#6c757d'}),
            'icone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'fas fa-heart'}),
            'ordem': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'placeholder': 'Ordem de exibição'}),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
    
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if self.user and self.user.gabinete:
            # Se o usuário tem gabinete, definir como inicial
            self.fields['gabinete'] = forms.ModelChoiceField(
                queryset=Gabinete.objects.filter(id=self.user.gabinete.id),
                initial=self.user.gabinete,
                widget=forms.HiddenInput()
            )


class ModeloDocumentoForm(forms.ModelForm):
    class Meta:
        model = ModeloDocumento
        fields = ['nome', 'tipo', 'assunto', 'conteudo', 'cabecalho', 'rodape', 'variaveis_disponiveis', 'ativo']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nome do modelo'}),
            'tipo': forms.Select(attrs={'class': 'form-select'}),
            'assunto': forms.Select(attrs={'class': 'form-select'}),
            'conteudo': forms.Textarea(attrs={'class': 'form-control', 'rows': 10, 'placeholder': 'Conteúdo do template'}),
            'cabecalho': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Cabeçalho padrão'}),
            'rodape': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Rodapé padrão'}),
            'variaveis_disponiveis': forms.Textarea(attrs={'class': 'form-control', 'rows': 2, 'placeholder': 'Variáveis disponíveis'}),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
    
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if self.user and self.user.gabinete:
            self.fields['assunto'].queryset = Assunto.objects.filter(gabinete=self.user.gabinete).order_by('nome')
            self.fields['assunto'].empty_label = "Selecione um assunto"


class JustificativaPadraoForm(forms.ModelForm):
    class Meta:
        model = JustificativaPadrao
        fields = ['nome', 'descricao', 'texto', 'ativo']
        widgets = {
            'nome': forms.TextInput(attrs={
                'class': 'form-control', 
                'placeholder': 'Nome identificador da justificativa'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control', 
                'rows': 2, 
                'placeholder': 'Descrição opcional da justificativa'
            }),
            'texto': forms.Textarea(attrs={
                'class': 'form-control', 
                'rows': 8, 
                'placeholder': 'Conteúdo da justificativa que será usado nos documentos'
            }),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
    
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if self.user and self.user.gabinete:
            # Adicionar campo gabinete como hidden
            self.fields['gabinete'] = forms.ModelChoiceField(
                queryset=Gabinete.objects.filter(id=self.user.gabinete.id),
                initial=self.user.gabinete,
                widget=forms.HiddenInput()
            )
    
    def clean_nome(self):
        nome = self.cleaned_data.get('nome')
        if self.user and self.user.gabinete:
            # Verificar se já existe uma justificativa com o mesmo nome no gabinete
            queryset = JustificativaPadrao.objects.filter(gabinete=self.user.gabinete, nome=nome)
            if self.instance.pk:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise forms.ValidationError('Já existe uma justificativa com este nome no gabinete.')
        return nome


class SolicitacaoPadraoForm(forms.ModelForm):
    class Meta:
        model = SolicitacaoPadrao
        fields = ['nome', 'descricao', 'texto', 'ativo']
        widgets = {
            'nome': forms.TextInput(attrs={
                'class': 'form-control', 
                'placeholder': 'Nome identificador da solicitação'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control', 
                'rows': 2, 
                'placeholder': 'Descrição opcional da solicitação'
            }),
            'texto': forms.Textarea(attrs={
                'class': 'form-control', 
                'rows': 8, 
                'placeholder': 'Conteúdo da solicitação que será usado nos documentos'
            }),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
    
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if self.user and self.user.gabinete:
            # Adicionar campo gabinete como hidden
            self.fields['gabinete'] = forms.ModelChoiceField(
                queryset=Gabinete.objects.filter(id=self.user.gabinete.id),
                initial=self.user.gabinete,
                widget=forms.HiddenInput()
            )
    
    def clean_nome(self):
        nome = self.cleaned_data.get('nome')
        if self.user and self.user.gabinete:
            # Verificar se já existe uma solicitação com o mesmo nome no gabinete
            queryset = SolicitacaoPadrao.objects.filter(gabinete=self.user.gabinete, nome=nome)
            if self.instance.pk:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise forms.ValidationError('Já existe uma solicitação com este nome no gabinete.')
        return nome
