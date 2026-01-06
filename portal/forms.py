from django import forms
from django.core.exceptions import ValidationError
from .models import Publicacao, SolicitacaoPublica, AgendamentoVisita
from accounts.models import Assunto


class SolicitacaoPublicaForm(forms.ModelForm):
    """Formulário para o cidadão enviar solicitações via portal"""
    
    class Meta:
        model = SolicitacaoPublica
        fields = [
            'nome_solicitante', 'cpf', 'email', 'telefone',
            'municipio', 'bairro', 'tipo_solicitacao', 'assunto',
            'descricao', 'anexo', 'consentimento_lgpd'
        ]
        widgets = {
            'nome_solicitante': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Seu nome completo'
            }),
            'cpf': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '000.000.000-00 (opcional)',
                'maxlength': '14'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'seu@email.com'
            }),
            'telefone': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '(00) 00000-0000'
            }),
            'municipio': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Sua cidade'
            }),
            'bairro': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Seu bairro'
            }),
            'tipo_solicitacao': forms.Select(attrs={
                'class': 'form-select'
            }, choices=[
                ('', 'Selecione o tipo de solicitação'),
                ('INFORMACAO', 'Solicitar Informação'),
                ('RECLAMACAO', 'Reclamação'),
                ('SUGESTAO', 'Sugestão'),
                ('DENUNCIA', 'Denúncia'),
                ('PEDIDO', 'Pedido de Serviço'),
                ('ELOGIO', 'Elogio'),
                ('OUTRO', 'Outro'),
            ]),
            'assunto': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Resumo do assunto'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'Descreva sua solicitação em detalhes...',
                'rows': 6
            }),
            'anexo': forms.FileInput(attrs={
                'class': 'form-control'
            }),
            'consentimento_lgpd': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }
        labels = {
            'nome_solicitante': 'Nome Completo *',
            'cpf': 'CPF',
            'email': 'E-mail *',
            'telefone': 'Telefone/WhatsApp *',
            'municipio': 'Município',
            'bairro': 'Bairro',
            'tipo_solicitacao': 'Tipo de Solicitação *',
            'assunto': 'Assunto *',
            'descricao': 'Descrição Detalhada *',
            'anexo': 'Anexar Arquivo (opcional)',
            'consentimento_lgpd': 'Li e concordo com a Política de Privacidade (LGPD) *',
        }
        help_texts = {
            'cpf': 'Opcional, mas ajuda na identificação',
            'anexo': 'Formatos aceitos: PDF, imagens (máx. 5MB)',
            'consentimento_lgpd': 'Seus dados serão usados exclusivamente para atender sua solicitação.',
        }
    
    def clean_consentimento_lgpd(self):
        consentimento = self.cleaned_data.get('consentimento_lgpd')
        if not consentimento:
            raise ValidationError('Você precisa concordar com a Política de Privacidade para prosseguir.')
        return consentimento
    
    def clean_anexo(self):
        anexo = self.cleaned_data.get('anexo')
        if anexo:
            # Validar tamanho (máx 5MB)
            if anexo.size > 5 * 1024 * 1024:
                raise ValidationError('O arquivo não pode ter mais de 5MB.')
            
            # Validar extensão
            extensoes_permitidas = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
            import os
            ext = os.path.splitext(anexo.name)[1].lower()
            if ext not in extensoes_permitidas:
                raise ValidationError(f'Formato não permitido. Use: {", ".join(extensoes_permitidas)}')
        
        return anexo


class AgendamentoVisitaForm(forms.ModelForm):
    """Formulário para agendamento de visitas presenciais"""
    
    class Meta:
        model = AgendamentoVisita
        fields = [
            'nome', 'cpf', 'email', 'telefone',
            'motivo', 'descricao', 'data_desejada', 'horario_preferencia',
            'consentimento_lgpd'
        ]
        widgets = {
            'nome': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Seu nome completo'
            }),
            'cpf': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '000.000.000-00 (opcional)'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'seu@email.com'
            }),
            'telefone': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '(00) 00000-0000'
            }),
            'motivo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ex: Solicitar apoio para projeto comunitário'
            }),
            'descricao': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'Descreva brevemente o motivo da visita...',
                'rows': 4
            }),
            'data_desejada': forms.DateInput(attrs={
                'class': 'form-control',
                'type': 'date'
            }),
            'horario_preferencia': forms.Select(attrs={
                'class': 'form-select'
            }, choices=[
                ('', 'Selecione o período preferido'),
                ('MANHA', 'Manhã (08:00 - 12:00)'),
                ('TARDE', 'Tarde (14:00 - 18:00)'),
                ('FLEXIVEL', 'Horário Flexível'),
            ]),
            'consentimento_lgpd': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }
        labels = {
            'nome': 'Nome Completo *',
            'cpf': 'CPF',
            'email': 'E-mail *',
            'telefone': 'Telefone/WhatsApp *',
            'motivo': 'Motivo da Visita *',
            'descricao': 'Descrição *',
            'data_desejada': 'Data Desejada *',
            'horario_preferencia': 'Período Preferido *',
            'consentimento_lgpd': 'Li e concordo com a Política de Privacidade (LGPD) *',
        }
    
    def clean_consentimento_lgpd(self):
        consentimento = self.cleaned_data.get('consentimento_lgpd')
        if not consentimento:
            raise ValidationError('Você precisa concordar com a Política de Privacidade.')
        return consentimento


class PublicacaoForm(forms.ModelForm):
    """Formulário para criar/editar publicações no painel admin"""
    
    class Meta:
        model = Publicacao
        fields = [
            'titulo', 'subtitulo', 'resumo', 'conteudo',
            'tipo', 'categoria', 'tags',
            'imagem_destaque', 'arquivo_anexo', 'link_externo',
            'destaque', 'status'
        ]
        widgets = {
            'titulo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Título da publicação'
            }),
            'subtitulo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Subtítulo (opcional)'
            }),
            'resumo': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Resumo curto que aparecerá na listagem'
            }),
            'conteudo': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 12,
                'placeholder': 'Conteúdo completo da publicação'
            }),
            'tipo': forms.Select(attrs={
                'class': 'form-select'
            }),
            'categoria': forms.Select(attrs={
                'class': 'form-select'
            }),
            'tags': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'tag1, tag2, tag3'
            }),
            'imagem_destaque': forms.FileInput(attrs={
                'class': 'form-control'
            }),
            'arquivo_anexo': forms.FileInput(attrs={
                'class': 'form-control'
            }),
            'link_externo': forms.URLInput(attrs={
                'class': 'form-control',
                'placeholder': 'https://exemplo.com'
            }),
            'destaque': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'status': forms.Select(attrs={
                'class': 'form-select'
            }),
        }
        labels = {
            'titulo': 'Título *',
            'subtitulo': 'Subtítulo',
            'resumo': 'Resumo',
            'conteudo': 'Conteúdo Completo *',
            'tipo': 'Tipo de Publicação *',
            'categoria': 'Categoria',
            'tags': 'Tags',
            'imagem_destaque': 'Imagem de Destaque',
            'arquivo_anexo': 'Arquivo Anexo',
            'link_externo': 'Link Externo',
            'destaque': 'Publicação em Destaque',
            'status': 'Status *',
        }
        help_texts = {
            'resumo': 'Será exibido nas listas de publicações',
            'tags': 'Separadas por vírgula',
            'imagem_destaque': 'Recomendado: 1200x630px',
            'destaque': 'Publicações em destaque aparecem na página inicial',
        }


class ResponderSolicitacaoForm(forms.Form):
    """Formulário para responder solicitações públicas"""
    
    resposta = forms.CharField(
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 6,
            'placeholder': 'Digite sua resposta ao cidadão...'
        }),
        label='Resposta ao Cidadão',
        required=True
    )
    
    criar_atendimento = forms.BooleanField(
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        }),
        label='Criar atendimento interno automaticamente',
        required=False,
        initial=True,
        help_text='Se marcado, criará um registro de atendimento no sistema'
    )


class ConfirmarVisitaForm(forms.Form):
    """Formulário para confirmar agendamento de visita"""
    
    data_confirmada = forms.DateTimeField(
        widget=forms.DateTimeInput(attrs={
            'class': 'form-control',
            'type': 'datetime-local'
        }),
        label='Data e Hora Confirmada',
        required=True
    )
    
    resposta_cidadao = forms.CharField(
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 4,
            'placeholder': 'Mensagem de confirmação que será enviada ao cidadão...'
        }),
        label='Mensagem ao Cidadão',
        required=False,
        initial='Sua visita foi confirmada! Compareça no horário agendado com documento de identificação.'
    )
    
    criar_evento = forms.BooleanField(
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        }),
        label='Criar evento na agenda do gabinete',
        required=False,
        initial=True,
        help_text='Se marcado, criará automaticamente um evento na agenda'
    )
