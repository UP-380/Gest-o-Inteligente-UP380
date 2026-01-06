from django import forms
from .models import Evento


class EventoForm(forms.ModelForm):
    class Meta:
        model = Evento
        fields = [
            'titulo', 'descricao', 'tipo', 'categoria', 'status', 'prioridade',
            'inicio', 'fim', 'dia_inteiro', 'local', 'endereco_completo', 'link',
            'participantes_pessoas', 'participantes_equipe', 'numero_participantes_esperado',
            'lembrete_minutos', 'enviar_convite', 'is_publico', 'is_recorrente',
            'recorrencia_tipo', 'observacoes', 'requisitos_especiais'
        ]
        widgets = {
            'titulo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Título do evento'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Descrição do evento'
            }),
            'tipo': forms.Select(attrs={
                'class': 'form-select'
            }),
            'categoria': forms.Select(attrs={
                'class': 'form-select'
            }),
            'status': forms.Select(attrs={
                'class': 'form-select'
            }),
            'prioridade': forms.Select(attrs={
                'class': 'form-select'
            }),
            'inicio': forms.DateTimeInput(attrs={
                'class': 'form-control',
                'type': 'datetime-local'
            }),
            'fim': forms.DateTimeInput(attrs={
                'class': 'form-control',
                'type': 'datetime-local'
            }),
            'dia_inteiro': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'local': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Local do evento'
            }),
            'endereco_completo': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'Endereço completo'
            }),
            'link': forms.URLInput(attrs={
                'class': 'form-control',
                'placeholder': 'https://...'
            }),
            'participantes_pessoas': forms.SelectMultiple(attrs={
                'class': 'form-select',
                'size': '5'
            }),
            'participantes_equipe': forms.SelectMultiple(attrs={
                'class': 'form-select',
                'size': '5'
            }),
            'numero_participantes_esperado': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': '0'
            }),
            'lembrete_minutos': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': '0',
                'value': '60'
            }),
            'enviar_convite': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'is_publico': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'is_recorrente': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'recorrencia_tipo': forms.Select(attrs={
                'class': 'form-select'
            }),
            'observacoes': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Observações internas'
            }),
            'requisitos_especiais': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'Requisitos especiais para o evento'
            }),
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        
        # Tornar campos opcionais
        self.fields['categoria'].required = False
        self.fields['status'].required = False
        self.fields['prioridade'].required = False
        self.fields['lembrete_minutos'].required = False
        
        # Definir valores padrão
        self.fields['status'].initial = 'AGENDADO'
        self.fields['prioridade'].initial = 'NORMAL'
        self.fields['lembrete_minutos'].initial = 60
        
        if self.user and hasattr(self.user, 'gabinete'):
            # Filtrar participantes pessoas apenas do gabinete do usuário
            from crm.models import Pessoa
            from accounts.models import User
            
            self.fields['participantes_pessoas'].queryset = Pessoa.objects.filter(
                gabinete=self.user.gabinete
            ).order_by('nome')
            
            # Filtrar participantes equipe apenas do gabinete do usuário
            self.fields['participantes_equipe'].queryset = User.objects.filter(
                gabinete=self.user.gabinete
            ).order_by('first_name', 'last_name')
            
            # Filtrar categoria apenas do gabinete do usuário
            from accounts.models import Assunto
            self.fields['categoria'].queryset = Assunto.objects.filter(
                gabinete=self.user.gabinete
            ).order_by('nome')
    
    def clean(self):
        cleaned_data = super().clean()
        inicio = cleaned_data.get('inicio')
        fim = cleaned_data.get('fim')
        
        # Validar se a data de fim é posterior à data de início
        if inicio and fim and fim <= inicio:
            raise forms.ValidationError("A data de fim deve ser posterior à data de início.")
        
        return cleaned_data
