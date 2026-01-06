from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db.models import Q
from .models import Publicacao, SolicitacaoPublica, AgendamentoVisita
from .forms import (
    SolicitacaoPublicaForm, AgendamentoVisitaForm, PublicacaoForm,
    ResponderSolicitacaoForm, ConfirmarVisitaForm
)
from accounts.decorators import admin_or_chefe_required
from crm.models import Pessoa
from atendimento.models import Atendimento
from agenda.models import Evento
from .email import enviar_email_resposta_solicitacao, enviar_email_confirmacao_visita


# ==================== VIEWS PÚBLICAS ====================

def portal_index(request, slug):
    """Página inicial do portal público"""
    from accounts.models import Gabinete
    
    # Buscar gabinete pelo slug
    gabinete = get_object_or_404(Gabinete, slug=slug, ativo=True)
    
    publicacoes_destaque = Publicacao.objects.filter(
        gabinete=gabinete,
        publico=True,
        status='PUBLICADO',
        destaque=True
    ).order_by('-data_publicacao')[:3]
    
    return render(request, 'portal/index.html', {
        'gabinete': gabinete,
        'publicacoes_destaque': publicacoes_destaque,
    })


def noticias_lista(request, slug):
    """Lista de notícias públicas"""
    from accounts.models import Gabinete
    
    # Buscar gabinete pelo slug
    gabinete = get_object_or_404(Gabinete, slug=slug, ativo=True)
    
    noticias = Publicacao.objects.filter(
        gabinete=gabinete,
        publico=True,
        status='PUBLICADO'
    ).order_by('-data_publicacao')
    
    # Filtros
    tipo = request.GET.get('tipo')
    if tipo:
        noticias = noticias.filter(tipo=tipo)
    
    return render(request, 'portal/noticias_lista.html', {
        'gabinete': gabinete,
        'noticias': noticias,
    })


def noticia_detalhe(request, slug, pk):
    """Detalhe de uma notícia"""
    from accounts.models import Gabinete
    
    # Buscar gabinete pelo slug
    gabinete = get_object_or_404(Gabinete, slug=slug, ativo=True)
    
    noticia = get_object_or_404(Publicacao, pk=pk, gabinete=gabinete, publico=True, status='PUBLICADO')
    
    # Incrementa visualizações
    noticia.visualizacoes += 1
    noticia.save()
    
    return render(request, 'portal/noticia_detalhe.html', {
        'gabinete': gabinete,
        'noticia': noticia,
    })


def solicitar_atendimento(request, slug):
    """Formulário de solicitação de atendimento público"""
    from accounts.models import Gabinete, SolicitacaoPadrao, Assunto
    
    # Buscar gabinete pelo slug
    gabinete = get_object_or_404(Gabinete, slug=slug, ativo=True)
    
    # Buscar solicitações padrão ativas
    solicitacoes_padrao = SolicitacaoPadrao.objects.filter(
        gabinete=gabinete,
        ativo=True
    ).order_by('nome')
    
    if request.method == 'POST':
        # Processar tipo_solicitacao (agora é o ID da SolicitacaoPadrao)
        tipo_solicitacao_id = request.POST.get('tipo_solicitacao')
        
        try:
            solicitacao_padrao = SolicitacaoPadrao.objects.get(id=tipo_solicitacao_id)
            tipo_solicitacao_nome = solicitacao_padrao.nome
            assunto_nome = solicitacao_padrao.nome  # Usar o nome como assunto
        except SolicitacaoPadrao.DoesNotExist:
            messages.error(request, 'Tipo de solicitação inválido.')
            return render(request, 'portal/solicitar_servico.html', {
                'solicitacoes_padrao': solicitacoes_padrao
            })
        
        # Criar solicitação manualmente
        solicitacao = SolicitacaoPublica(
            gabinete=gabinete,
            nome_solicitante=request.POST.get('nome_solicitante'),
            cpf=request.POST.get('cpf', ''),
            email=request.POST.get('email'),
            telefone=request.POST.get('telefone'),
            municipio=request.POST.get('municipio', ''),
            bairro=request.POST.get('bairro', ''),
            tipo_solicitacao=tipo_solicitacao_nome,  # Salvar o nome
            assunto=assunto_nome,  # Usar o nome da solicitação padrão
            descricao=request.POST.get('descricao'),
            consentimento_lgpd=request.POST.get('consentimento_lgpd') == 'on',
            consentimento_texto="Aceito que meus dados sejam utilizados exclusivamente para atendimento desta solicitação, conforme a LGPD."
        )
        
        # Capturar IP e User Agent
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            solicitacao.ip_origem = x_forwarded_for.split(',')[0]
        else:
            solicitacao.ip_origem = request.META.get('REMOTE_ADDR')
        solicitacao.user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        # Processar anexo se houver
        if 'anexo' in request.FILES:
            solicitacao.anexo = request.FILES['anexo']
        
        # Salvar solicitação
        solicitacao.save()
        
        # ✅ Pessoa e Atendimento serão criados AUTOMATICAMENTE pelo signal!
        # Veja: portal/signals.py -> criar_atendimento_automatico()
        # O signal também envia email automaticamente
        
        # Redirecionar para página de sucesso com protocolo
        return redirect('portal:sucesso_solicitacao', slug=gabinete.slug, protocolo=solicitacao.protocolo_publico)
    
    return render(request, 'portal/solicitar_servico.html', {
        'gabinete': gabinete,
        'solicitacoes_padrao': solicitacoes_padrao
    })


def consultar_protocolo(request, slug):
    """Consulta de protocolo público"""
    from accounts.models import Gabinete
    
    # Buscar gabinete pelo slug
    gabinete = get_object_or_404(Gabinete, slug=slug, ativo=True)
    
    solicitacao = None
    visita = None
    tipo_protocolo = None
    
    if request.method == 'GET' and 'protocolo' in request.GET:
        protocolo = request.GET.get('protocolo').strip().upper()
        
        # Tentar buscar em solicitações (PUB-*)
        if protocolo.startswith('PUB-'):
            try:
                solicitacao = SolicitacaoPublica.objects.get(protocolo_publico=protocolo, gabinete=gabinete)
                tipo_protocolo = 'solicitacao'
            except SolicitacaoPublica.DoesNotExist:
                messages.error(request, f'Protocolo {protocolo} não encontrado.')
        
        # Tentar buscar em agendamentos de visita (VIS-*)
        elif protocolo.startswith('VIS-'):
            try:
                visita = AgendamentoVisita.objects.get(protocolo=protocolo, gabinete=gabinete)
                tipo_protocolo = 'visita'
            except AgendamentoVisita.DoesNotExist:
                messages.error(request, f'Protocolo {protocolo} não encontrado.')
        
        # Se não tem prefixo, tentar ambos
        else:
            try:
                solicitacao = SolicitacaoPublica.objects.get(protocolo_publico=protocolo, gabinete=gabinete)
                tipo_protocolo = 'solicitacao'
            except SolicitacaoPublica.DoesNotExist:
                try:
                    visita = AgendamentoVisita.objects.get(protocolo=protocolo, gabinete=gabinete)
                    tipo_protocolo = 'visita'
                except AgendamentoVisita.DoesNotExist:
                    messages.error(request, f'Protocolo {protocolo} não encontrado.')
    
    return render(request, 'portal/consultar_protocolo.html', {
        'gabinete': gabinete,
        'solicitacao': solicitacao,
        'visita': visita,
        'tipo_protocolo': tipo_protocolo,
    })


def agendar_visita(request, slug):
    """Formulário de agendamento de visita"""
    from accounts.models import Gabinete
    
    # Buscar gabinete pelo slug
    gabinete = get_object_or_404(Gabinete, slug=slug, ativo=True)
    
    if request.method == 'POST':
        form = AgendamentoVisitaForm(request.POST)
        if form.is_valid():
            visita = form.save(commit=False)
            visita.gabinete = gabinete
            
            # Capturar IP
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                visita.ip_origem = x_forwarded_for.split(',')[0]
            else:
                visita.ip_origem = request.META.get('REMOTE_ADDR')
            
            visita.save()
            
            # Usar SLA configurado no gabinete
            sla_horas = gabinete.sla_resposta_visitas
            mensagem_sla = f'em até {sla_horas} horas' if sla_horas else 'em breve'
            
            messages.success(
                request,
                f'Solicitação de visita enviada com sucesso! Protocolo: {visita.protocolo}. '
                f'Aguarde confirmação por e-mail {mensagem_sla}.'
            )
            return redirect('portal:index', slug=gabinete.slug)
        else:
            messages.error(request, 'Por favor, corrija os erros no formulário.')
    else:
        form = AgendamentoVisitaForm()
    
    return render(request, 'portal/agendar_visita.html', {
        'form': form,
        'gabinete': gabinete,
    })


def sucesso_solicitacao(request, slug, protocolo):
    """Página de sucesso após envio de solicitação"""
    from accounts.models import Gabinete
    
    # Buscar gabinete pelo slug
    gabinete = get_object_or_404(Gabinete, slug=slug, ativo=True)
    
    return render(request, 'portal/sucesso_solicitacao.html', {
        'gabinete': gabinete,
        'protocolo': protocolo,
    })


# ==================== VIEWS ADMINISTRATIVAS ====================

@login_required
@admin_or_chefe_required
def portal_admin_dashboard(request):
    """Dashboard administrativo do portal"""
    stats = {
        'publicacoes_rascunho': Publicacao.objects.filter(
            gabinete=request.user.gabinete,
            status='RASCUNHO'
        ).count(),
        'publicacoes_aguardando': Publicacao.objects.filter(
            gabinete=request.user.gabinete,
            status='AGUARDANDO_APROVACAO'
        ).count(),
        'solicitacoes_pendentes': SolicitacaoPublica.objects.filter(
            gabinete=request.user.gabinete,
            status='PENDENTE'
        ).count(),
        'visitas_pendentes': AgendamentoVisita.objects.filter(
            gabinete=request.user.gabinete,
            status='PENDENTE'
        ).count(),
    }
    
    return render(request, 'portal/admin/dashboard.html', {
        'stats': stats,
    })


@login_required
@admin_or_chefe_required
def publicacoes_lista(request):
    """Lista de publicações (admin)"""
    publicacoes = Publicacao.objects.filter(
        gabinete=request.user.gabinete
    ).order_by('-criado_em')
    
    # Filtros
    status = request.GET.get('status')
    tipo = request.GET.get('tipo')
    busca = request.GET.get('busca')
    
    if status:
        publicacoes = publicacoes.filter(status=status)
    if tipo:
        publicacoes = publicacoes.filter(tipo=tipo)
    if busca:
        publicacoes = publicacoes.filter(
            Q(titulo__icontains=busca) | Q(conteudo__icontains=busca)
        )
    
    return render(request, 'portal/admin/publicacoes_lista.html', {
        'publicacoes': publicacoes,
    })


@login_required
@admin_or_chefe_required
def publicacao_form(request, pk=None):
    """Formulário de publicação"""
    if pk:
        publicacao = get_object_or_404(Publicacao, pk=pk, gabinete=request.user.gabinete)
    else:
        publicacao = None
    
    if request.method == 'POST':
        form = PublicacaoForm(request.POST, request.FILES, instance=publicacao)
        if form.is_valid():
            nova_publicacao = form.save(commit=False)
            nova_publicacao.gabinete = request.user.gabinete
            
            if not publicacao:  # Nova publicação
                nova_publicacao.criado_por = request.user
            
            # Se clicar em "Salvar e Publicar"
            if request.POST.get('action') == 'publish':
                nova_publicacao.status = 'PUBLICADO'
                nova_publicacao.publico = True
                nova_publicacao.aprovado_por = request.user
                nova_publicacao.data_publicacao = timezone.now()
            
            nova_publicacao.save()
            
            messages.success(request, 'Publicação salva com sucesso!')
            return redirect('portal:publicacoes_lista')
        else:
            messages.error(request, 'Por favor, corrija os erros no formulário.')
    else:
        form = PublicacaoForm(instance=publicacao)
    
    return render(request, 'portal/admin/publicacao_form.html', {
        'form': form,
        'publicacao': publicacao,
    })


@login_required
@admin_or_chefe_required
def publicar_publicacao(request, pk):
    """Publica uma publicação"""
    publicacao = get_object_or_404(Publicacao, pk=pk, gabinete=request.user.gabinete)
    
    publicacao.status = 'PUBLICADO'
    publicacao.publico = True
    publicacao.data_publicacao = timezone.now()
    publicacao.aprovado_por = request.user
    publicacao.save()
    
    messages.success(request, f'Publicação "{publicacao.titulo}" publicada com sucesso!')
    return redirect('portal:publicacoes_lista')


@login_required
@admin_or_chefe_required
def excluir_publicacao(request, pk):
    """Exclui uma publicação"""
    if request.method == 'POST':
        publicacao = get_object_or_404(Publicacao, pk=pk, gabinete=request.user.gabinete)
        titulo = publicacao.titulo
        
        try:
            # Deletar arquivos antes de deletar o registro
            if publicacao.imagem_destaque:
                try:
                    publicacao.imagem_destaque.delete(save=False)
                except:
                    pass  # Ignora erro se arquivo não existir
            
            if publicacao.arquivo_anexo:
                try:
                    publicacao.arquivo_anexo.delete(save=False)
                except:
                    pass  # Ignora erro se arquivo não existir
            
            # Deletar o registro
            publicacao.delete()
            
            messages.success(request, f'Publicação "{titulo}" excluída com sucesso!')
        
        except Exception as e:
            messages.error(request, f'Erro ao excluir publicação: {str(e)}')
    
    else:
        messages.error(request, 'Método não permitido. Use o botão de exclusão.')
    
    return redirect('portal:publicacoes_lista')


@login_required
@admin_or_chefe_required
def solicitacoes_admin(request):
    """Lista de solicitações (admin)"""
    solicitacoes = SolicitacaoPublica.objects.filter(
        gabinete=request.user.gabinete
    ).order_by('-criado_em')
    
    # Filtros
    status = request.GET.get('status')
    busca = request.GET.get('busca')
    data_inicio = request.GET.get('data_inicio')
    
    if status:
        solicitacoes = solicitacoes.filter(status=status)
    if busca:
        solicitacoes = solicitacoes.filter(
            Q(nome_solicitante__icontains=busca) |
            Q(protocolo_publico__icontains=busca) |
            Q(assunto__icontains=busca)
        )
    if data_inicio:
        solicitacoes = solicitacoes.filter(criado_em__date__gte=data_inicio)
    
    return render(request, 'portal/admin/solicitacoes_lista.html', {
        'solicitacoes': solicitacoes,
    })


@login_required
@admin_or_chefe_required
def responder_solicitacao(request, pk):
    """Responde uma solicitação"""
    solicitacao = get_object_or_404(SolicitacaoPublica, pk=pk, gabinete=request.user.gabinete)
    
    if request.method == 'POST':
        form = ResponderSolicitacaoForm(request.POST)
        if form.is_valid():
            resposta = form.cleaned_data['resposta']
            criar_atendimento = form.cleaned_data['criar_atendimento']
            
            solicitacao.resposta = resposta
            solicitacao.resposta_texto = resposta  # Para o email
            solicitacao.status = 'RESPONDIDA'
            solicitacao.data_resposta = timezone.now()
            solicitacao.respondido_em = timezone.now()
            solicitacao.respondido_por = request.user
            solicitacao.save()
            
            # ✅ Enviar email de resposta para o cidadão
            enviar_email_resposta_solicitacao(solicitacao)
            
            # Criar atendimento se marcado
            if criar_atendimento and solicitacao.pode_criar_atendimento:
                # Buscar ou criar pessoa no CRM
                pessoa, created = Pessoa.objects.get_or_create(
                    gabinete=request.user.gabinete,
                    email=solicitacao.email,
                    defaults={
                        'nome': solicitacao.nome_solicitante,
                        'cpf': solicitacao.cpf or '',
                        'telefone': solicitacao.telefone,
                        'tipo': 'CIDADAO',
                        'origem': 'Portal do Cidadão',
                        'consentiu_contato': solicitacao.consentimento_lgpd,
                    }
                )
                
                if not created and solicitacao.cpf:
                    pessoa.cpf = solicitacao.cpf
                    pessoa.telefone = solicitacao.telefone
                    pessoa.save()
                
                solicitacao.pessoa_criada = pessoa
                
                # Criar atendimento
                atendimento = Atendimento.objects.create(
                    gabinete=request.user.gabinete,
                    pessoa=pessoa,
                    assunto=solicitacao.assunto,
                    descricao=f"Solicitação via Portal (Protocolo: {solicitacao.protocolo_publico})\n\n{solicitacao.descricao}",
                    origem='PORTAL',
                    origem_detalhes=f'Protocolo Público: {solicitacao.protocolo_publico}',
                    status='ABERTO',
                    criado_por=request.user,
                )
                
                solicitacao.atendimento_gerado = atendimento
                solicitacao.status = 'ATENDIMENTO_CRIADO'
                solicitacao.save()
                
                messages.success(request, f'Solicitação respondida e atendimento {atendimento.protocolo} criado!')
            else:
                messages.success(request, 'Solicitação respondida com sucesso!')
            
            return redirect('portal:solicitacoes_admin')
        else:
            messages.error(request, 'Por favor, corrija os erros.')
    else:
        form = ResponderSolicitacaoForm()
    
    return render(request, 'portal/admin/responder_solicitacao.html', {
        'solicitacao': solicitacao,
        'form': form,
    })


@login_required
@admin_or_chefe_required
def visitas_admin(request):
    """Lista de agendamentos de visitas (admin)"""
    visitas = AgendamentoVisita.objects.filter(
        gabinete=request.user.gabinete
    ).order_by('-criado_em')
    
    # Filtros
    status = request.GET.get('status')
    busca = request.GET.get('busca')
    data = request.GET.get('data')
    
    if status:
        visitas = visitas.filter(status=status)
    if busca:
        visitas = visitas.filter(
            Q(nome__icontains=busca) |
            Q(protocolo__icontains=busca) |
            Q(motivo__icontains=busca)
        )
    if data:
        visitas = visitas.filter(data_desejada=data)
    
    return render(request, 'portal/admin/visitas_lista.html', {
        'visitas': visitas,
    })


@login_required
@admin_or_chefe_required
def confirmar_visita(request, pk):
    """Confirma um agendamento de visita"""
    visita = get_object_or_404(AgendamentoVisita, pk=pk, gabinete=request.user.gabinete)
    
    if request.method == 'POST':
        form = ConfirmarVisitaForm(request.POST)
        if form.is_valid():
            data_confirmada = form.cleaned_data['data_confirmada']
            resposta_cidadao = form.cleaned_data['resposta_cidadao']
            criar_evento = form.cleaned_data['criar_evento']
            
            visita.status = 'CONFIRMADO'
            visita.confirmado_por = request.user
            visita.data_confirmada = data_confirmada
            visita.resposta_cidadao = resposta_cidadao
            visita.save()
            
            # Criar evento se marcado
            if criar_evento and not visita.evento_criado:
                evento = Evento.objects.create(
                    gabinete=request.user.gabinete,
                    titulo=f"Visita: {visita.nome}",
                    descricao=f"Motivo: {visita.motivo}\n\n{visita.descricao}",
                    tipo='ATENDIMENTO',
                    inicio=data_confirmada,
                    fim=data_confirmada + timezone.timedelta(hours=1),  # 1 hora de duração padrão
                    local='Gabinete',
                    organizador=request.user,
                    criado_por=request.user,
                    vai_acontecer=True,
                )
                
                visita.evento_criado = evento
                visita.save()
                
                messages.success(request, f'Visita confirmada e evento criado na agenda!')
            else:
                messages.success(request, 'Visita confirmada com sucesso!')
            
            return redirect('portal:visitas_admin')
        else:
            messages.error(request, 'Por favor, corrija os erros.')
    else:
        form = ConfirmarVisitaForm()
    
    return render(request, 'portal/admin/confirmar_visita.html', {
        'visita': visita,
        'form': form,
    })
