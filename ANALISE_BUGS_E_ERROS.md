# 🔍 ANÁLISE COMPLETA - BUGS E ERROS ENCONTRADOS

**Data:** 06/01/2026  
**Status:** ⚠️ PROBLEMAS IDENTIFICADOS

---

## 🚨 BUGS CRÍTICOS (Afetam Funcionalidade)

### **1. ❌ ENVIO DE EMAIL NÃO IMPLEMENTADO**

**Problema:** O sistema promete enviar email com protocolo, mas não envia!

**Onde:** 
- Portal do Visitante (Solicitações e Agendamentos)
- Mensagens dizem: "Você receberá um e-mail de confirmação"
- **MAS NÃO HÁ CÓDIGO DE ENVIO DE EMAIL!**

**Impacto:** 
- ❌ Usuários não recebem protocolo por email
- ❌ Promessa não cumprida
- ❌ Má experiência do usuário

**Arquivos afetados:**
- `portal/views.py` - Não envia email
- `portal/signals.py` - Não envia email
- `templates/portal/sucesso_solicitacao.html` - Diz que email foi enviado (MENTIRA!)

**Código problemático:**
```python
# portal/views.py linha 179
return redirect('portal:sucesso_solicitacao', slug=gabinete.slug, protocolo=solicitacao.protocolo_publico)

# templates/portal/sucesso_solicitacao.html linha 36
"Enviamos uma confirmação com o número do protocolo para..."
# ⚠️ MAS NÃO ENVIA NADA!
```

**Solução Necessária:**
```python
from django.core.mail import send_mail

def enviar_email_confirmacao(solicitacao):
    send_mail(
        subject=f'Protocolo de Solicitação: {solicitacao.protocolo_publico}',
        message=f'Seu protocolo é: {solicitacao.protocolo_publico}...',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[solicitacao.email],
    )
```

---

### **2. ⚠️ DUPLICAÇÃO DE LÓGICA (Pessoa e Atendimento criados 2x)**

**Problema:** Pessoa e Atendimento são criados DUAS VEZES:
1. Na VIEW `solicitar_atendimento` (linhas 139-175)
2. No SIGNAL `criar_atendimento_automatico` (linhas 18-77)

**Onde:**
- `portal/views.py` - Cria manualmente
- `portal/signals.py` - Cria automaticamente via signal

**Impacto:**
- ⚠️ Código duplicado (difícil manutenção)
- ⚠️ Possível criar registros duplicados
- ⚠️ Lógica confusa

**Código problemático:**
```python
# portal/views.py linha 139-175
pessoa, created = Pessoa.objects.get_or_create(...)
atendimento = Atendimento.objects.create(...)

# portal/signals.py linha 18-77
@receiver(post_save, sender=SolicitacaoPublica)
def criar_atendimento_automatico(sender, instance, created, **kwargs):
    pessoa = Pessoa.objects.create(...)
    atendimento = Atendimento.objects.create(...)
```

**Solução:**
- Escolher UMA abordagem:
  - **Opção A:** Remover da view, deixar só o signal
  - **Opção B:** Remover o signal, deixar só na view

**Recomendação:** Usar SIGNAL (mais limpo e automático)

---

### **3. ⚠️ FORMULÁRIO DO PORTAL AINDA TEM CAMPO 'ASSUNTO'**

**Problema:** O formulário `SolicitacaoPublicaForm` ainda tem:
- Campo `assunto` (deveria ser removido)
- `tipo_solicitacao` com choices hardcoded (deveria ser dinâmico)

**Onde:** `portal/forms.py` linhas 14, 43-54, 55-58, 79

**Impacto:**
- ⚠️ Formulário não está como especificado
- ⚠️ Não usa "Solicitações Padrões" dinamicamente
- ⚠️ Inconsistente com view que busca SolicitacaoPadrao

**Código problemático:**
```python
# portal/forms.py linha 14
fields = [
    ..., 'tipo_solicitacao', 'assunto',  # ❌ 'assunto' deveria ser removido
]

# portal/forms.py linha 43-54
'tipo_solicitacao': forms.Select(attrs={
    'class': 'form-select'
}, choices=[  # ❌ Hardcoded, deveria ser dinâmico
    ('', 'Selecione o tipo de solicitação'),
    ('INFORMACAO', 'Solicitar Informação'),
    ...
]),
```

**Solução:**
```python
# Remover 'assunto' dos fields
fields = [
    'nome_solicitante', 'cpf', 'email', 'telefone',
    'municipio', 'bairro', 'tipo_solicitacao',  # sem 'assunto'
    'descricao', 'anexo', 'consentimento_lgpd'
]

# Fazer tipo_solicitacao dinâmico
'tipo_solicitacao': forms.Select(attrs={'class': 'form-select'})
# Sem choices= (será populado pela view)
```

---

## ⚠️ PROBLEMAS MÉDIOS (Afetam Qualidade)

### **4. ⚠️ TELEFONE SEM MAXLENGTH EM ALGUNS FORMS**

**Problema:** Alguns formulários não têm `maxlength='15'` no telefone

**Onde:**
- `portal/forms.py` linha 31-34 (SolicitacaoPublicaForm)
- `portal/forms.py` linha 128-131 (AgendamentoVisitaForm)

**Impacto:**
- ⚠️ Usuário pode digitar mais de 15 caracteres
- ⚠️ Máscara JavaScript não previne isso totalmente
- ⚠️ Inconsistência com outros forms

**Solução:**
```python
'telefone': forms.TextInput(attrs={
    'class': 'form-control',
    'placeholder': '(00) 00000-0000',
    'maxlength': '15'  # ✅ Adicionar
}),
```

---

### **5. ⚠️ SECURITY WARNINGS (Apenas Desenvolvimento)**

**Problema:** Django check --deploy mostra 6 warnings de segurança

**Onde:** `mais_compliance/settings.py`

**Avisos:**
1. `DEBUG = True` (não usar em produção)
2. `SECRET_KEY` curta
3. `SECURE_HSTS_SECONDS` não configurado
4. `SECURE_SSL_REDIRECT = False`
5. `SESSION_COOKIE_SECURE = False`
6. `CSRF_COOKIE_SECURE = False`

**Impacto:**
- ✅ OK para desenvolvimento local
- ❌ CRÍTICO para produção

**Solução (quando for para produção):**
```python
# settings.py

DEBUG = False
SECRET_KEY = 'chave-longa-e-aleatória-de-50+ caracteres'
ALLOWED_HOSTS = ['seudominio.com']

SECURE_HSTS_SECONDS = 31536000
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

---

## ℹ️ OBSERVAÇÕES (Não São Bugs)

### **6. ℹ️ Campo 'assunto' ainda existe no MODELO**

**Observação:** O campo `assunto` ainda existe em `SolicitacaoPublica` model

**Onde:** `portal/models.py` linha 161

**Não é bug porque:**
- ✅ O campo é preenchido automaticamente na view
- ✅ Usa o nome da SolicitacaoPadrao como assunto
- ✅ Signal usa instance.assunto e funciona

**Código atual (OK):**
```python
# portal/views.py linha 107
assunto_nome = solicitacao_padrao.nome  # Usa nome da SolicitacaoPadrao
solicitacao.assunto = assunto_nome  # Preenche automaticamente
```

---

### **7. ℹ️ Console.EmailBackend em uso**

**Observação:** Emails vão para o console, não são enviados de verdade

**Onde:** `mais_compliance/settings.py`

```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

**Não é bug porque:**
- ✅ Apropriado para desenvolvimento
- ✅ Mostra emails no terminal
- ⚠️ Mas precisa ser configurado para produção

**Para produção:**
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'seu-email@gmail.com'
EMAIL_HOST_PASSWORD = 'sua-senha-app'
```

---

## 📊 RESUMO DOS PROBLEMAS

| Tipo | Quantidade | Criticidade |
|------|------------|-------------|
| 🚨 Bugs Críticos | 3 | ALTA |
| ⚠️ Problemas Médios | 2 | MÉDIA |
| ℹ️ Observações | 2 | BAIXA |
| **TOTAL** | **7** | - |

---

## 🎯 PRIORIDADE DE CORREÇÃO

### **Prioridade ALTA (Fazer AGORA):**

1. ✅ **Implementar envio de email** - Usuários esperam receber!
2. ✅ **Remover duplicação** - Escolher signal OU view para criar atendimento
3. ✅ **Corrigir formulário** - Remover campo 'assunto' da exibição

### **Prioridade MÉDIA (Fazer em Breve):**

4. ✅ **Adicionar maxlength** - Melhorar validação
5. ℹ️ **Revisar security** - Preparar para produção (futuro)

### **Prioridade BAIXA (Opcional):**

6. ℹ️ **Configurar email** - Quando subir para produção
7. ℹ️ **Campo assunto** - Já funciona, só documentar

---

## 🔧 CORREÇÕES SUGERIDAS

### **Correção 1: Implementar Envio de Email**

**Arquivo:** Criar `portal/email.py`

```python
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string

def enviar_email_solicitacao(solicitacao):
    """Envia email de confirmação de solicitação"""
    assunto = f'Protocolo de Solicitação: {solicitacao.protocolo_publico}'
    
    mensagem = f"""
    Olá, {solicitacao.nome_solicitante}!
    
    Sua solicitação foi recebida com sucesso!
    
    Protocolo: {solicitacao.protocolo_publico}
    Data: {solicitacao.criado_em.strftime('%d/%m/%Y %H:%M')}
    Tipo: {solicitacao.tipo_solicitacao}
    
    Você pode consultar o andamento em:
    {settings.SITE_URL}/portal/{solicitacao.gabinete.slug}/consultar/?protocolo={solicitacao.protocolo_publico}
    
    Atenciosamente,
    {solicitacao.gabinete.parlamentar_nome}
    """
    
    send_mail(
        subject=assunto,
        message=mensagem,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[solicitacao.email],
        fail_silently=False,
    )

def enviar_email_agendamento(agendamento):
    """Envia email de confirmação de agendamento"""
    assunto = f'Protocolo de Agendamento: {agendamento.protocolo}'
    
    mensagem = f"""
    Olá, {agendamento.nome}!
    
    Seu agendamento de visita foi recebido!
    
    Protocolo: {agendamento.protocolo}
    Data desejada: {agendamento.data_desejada.strftime('%d/%m/%Y')}
    
    Aguarde confirmação em até {agendamento.gabinete.sla_resposta_visitas} horas.
    
    Atenciosamente,
    {agendamento.gabinete.parlamentar_nome}
    """
    
    send_mail(
        subject=assunto,
        message=mensagem,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[agendamento.email],
        fail_silently=False,
    )
```

**Adicionar no signal:**
```python
# portal/signals.py

from .email import enviar_email_solicitacao, enviar_email_agendamento

@receiver(post_save, sender=SolicitacaoPublica)
def criar_atendimento_automatico(sender, instance, created, **kwargs):
    if created and not instance.atendimento_gerado:
        try:
            # ... código existente ...
            
            # ✅ Enviar email
            enviar_email_solicitacao(instance)
            
        except Exception as e:
            print(f"❌ Erro: {e}")
```

---

### **Correção 2: Remover Duplicação (Usar Signal)**

**Remover da view:**
```python
# portal/views.py - REMOVER linhas 139-175

# Não precisa mais criar pessoa e atendimento aqui!
# O signal faz isso automaticamente
```

**Manter apenas:**
```python
# portal/views.py

solicitacao.save()

# Redirecionar (signal cria pessoa e atendimento automaticamente)
return redirect('portal:sucesso_solicitacao', slug=gabinete.slug, protocolo=solicitacao.protocolo_publico)
```

---

### **Correção 3: Corrigir Formulário**

**Atualizar `portal/forms.py`:**

```python
class SolicitacaoPublicaForm(forms.ModelForm):
    class Meta:
        model = SolicitacaoPublica
        fields = [
            'nome_solicitante', 'cpf', 'email', 'telefone',
            'municipio', 'bairro', 'tipo_solicitacao',  # ✅ Sem 'assunto'
            'descricao', 'anexo', 'consentimento_lgpd'
        ]
        widgets = {
            # ... outros campos ...
            'tipo_solicitacao': forms.Select(attrs={
                'class': 'form-select'
            }),  # ✅ Sem choices= (dinâmico)
            # ✅ Remover widget de 'assunto'
            'telefone': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '(00) 00000-0000',
                'maxlength': '15'  # ✅ Adicionar maxlength
            }),
        }
        labels = {
            # ... outros labels ...
            'tipo_solicitacao': 'Tipo de Solicitação *',
            # ✅ Remover label de 'assunto'
        }
```

---

## ✅ CHECKLIST DE CORREÇÕES

- [ ] Implementar envio de email (Prioridade ALTA)
- [ ] Remover duplicação view/signal (Prioridade ALTA)
- [ ] Corrigir formulário - remover 'assunto' (Prioridade ALTA)
- [ ] Adicionar maxlength em telefones (Prioridade MÉDIA)
- [ ] Documentar configuração de email (Prioridade BAIXA)

---

## 🎉 BOA NOTÍCIA!

✅ **Não há bugs graves de lógica ou segurança**  
✅ **O sistema funciona, apenas precisa de ajustes**  
✅ **Migrations estão em dia**  
✅ **Código limpo sem erros de lint**  

---

## 📞 CONCLUSÃO

O sistema está **funcional** mas tem **3 problemas importantes**:

1. 🚨 **Email não enviado** - Promessa não cumprida
2. ⚠️ **Código duplicado** - Criar pessoa/atendimento 2x
3. ⚠️ **Formulário desatualizado** - Campo 'assunto' ainda aparece

**Recomendação:** Corrigir os 3 problemas de Prioridade ALTA antes de usar em produção!

**Tempo estimado:** 2-3 horas para todas as correções

---

**Relatório gerado em:** 06/01/2026  
**Status do Sistema:** ⚠️ FUNCIONAL COM RESSALVAS


