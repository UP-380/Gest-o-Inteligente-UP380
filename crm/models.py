from django.db import models
from django.utils import timezone
from accounts.models import Gabinete


class Pessoa(models.Model):
    """Modelo para representar pessoas/contatos do gabinete"""
    TIPO_CHOICES = [
        ('ELEITOR', 'Eleitor'),
        ('LIDERANCA', 'Liderança'),
        ('PARCEIRO', 'Parceiro'),
        ('ORGAO', 'Órgão Público'),
    ]

    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='pessoas',
        verbose_name='Gabinete'
    )
    nome = models.CharField(max_length=200, verbose_name='Nome Completo')
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default='ELEITOR',
        verbose_name='Tipo'
    )
    cpf = models.CharField(max_length=14, blank=True, verbose_name='CPF')
    email = models.EmailField(blank=True, verbose_name='E-mail')
    telefone = models.CharField(max_length=20, blank=True, verbose_name='Telefone')
    bairro = models.CharField(max_length=100, blank=True, verbose_name='Bairro')
    zona_eleitoral = models.CharField(max_length=50, blank=True, verbose_name='Zona Eleitoral')
    
    # LGPD - Consentimento para contato
    consentiu_contato = models.BooleanField(
        default=False,
        verbose_name='Consentiu para contato'
    )
    consentido_em = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Consentido em'
    )
    
    origem = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Origem do contato'
    )
    tags = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='Tags (separadas por vírgula)'
    )
    observacoes = models.TextField(blank=True, verbose_name='Observações')
    
    # Metadados
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    criado_por = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pessoas_criadas',
        verbose_name='Criado por'
    )

    class Meta:
        verbose_name = 'Pessoa'
        verbose_name_plural = 'Pessoas'
        ordering = ['nome']
        unique_together = ['gabinete', 'cpf']

    def __str__(self):
        return self.nome

    def get_tipo_display(self):
        """Retorna o tipo formatado"""
        return dict(self.TIPO_CHOICES).get(self.tipo, self.tipo)

    def get_tags_list(self):
        """Retorna as tags como lista"""
        if self.tags:
            return [tag.strip() for tag in self.tags.split(',') if tag.strip()]
        return []

    def save(self, *args, **kwargs):
        # Se consentiu_contato for True e consentido_em for None, definir data atual
        if self.consentiu_contato and not self.consentido_em:
            self.consentido_em = timezone.now()
        super().save(*args, **kwargs)

    @property
    def tem_contato(self):
        """Verifica se a pessoa tem informações de contato"""
        return bool(self.email or self.telefone)

    @property
    def contato_principal(self):
        """Retorna o contato principal (telefone ou email)"""
        return self.telefone or self.email


