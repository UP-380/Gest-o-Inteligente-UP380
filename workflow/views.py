from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import Q, Count, Avg
from django.utils import timezone
from django.core.paginator import Paginator
from datetime import datetime, timedelta
import json

from .models import (
    TipoWorkflow, ProcessoWorkflow, ExecucaoEtapa, 
    RegrasAutomacao, HistoricoWorkflow
)
from .forms import ProcessoWorkflowForm, ExecucaoEtapaForm
from accounts.models import Gabinete


@login_required
def dashboard_workflow(request):
    """Dashboard principal do sistema de workflow"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    
    # Estatísticas gerais
    processos_ativos = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        status__in=['INICIADO', 'EM_ANDAMENTO']
    ).count()
    
    processos_atrasados = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        prazo_final__lt=timezone.now(),
        status__in=['INICIADO', 'EM_ANDAMENTO']
    ).count()
    
    etapas_pendentes = ExecucaoEtapa.objects.filter(
        processo__gabinete=gabinete,
        status='PENDENTE'
    ).count()
    
    etapas_em_andamento = ExecucaoEtapa.objects.filter(
        processo__gabinete=gabinete,
        status='EM_ANDAMENTO'
    ).count()
    
    # Processos por status
    processos_por_status = ProcessoWorkflow.objects.filter(
        gabinete=gabinete
    ).values('status').annotate(
        total=Count('id')
    ).order_by('status')
    
    # Processos por tipo
    processos_por_tipo = ProcessoWorkflow.objects.filter(
        gabinete=gabinete
    ).values('tipo_workflow__nome').annotate(
        total=Count('id')
    ).order_by('-total')[:5]
    
    # Processos recentes
    processos_recentes = ProcessoWorkflow.objects.filter(
        gabinete=gabinete
    ).select_related('tipo_workflow', 'responsavel_atual').order_by('-criado_em')[:10]
    
    # Etapas com prazo próximo (próximos 3 dias)
    prazo_proximo = timezone.now() + timedelta(days=3)
    etapas_prazo_proximo = ExecucaoEtapa.objects.filter(
        processo__gabinete=gabinete,
        status__in=['PENDENTE', 'EM_ANDAMENTO'],
        prazo__lte=prazo_proximo,
        prazo__gte=timezone.now()
    ).select_related('processo', 'etapa', 'responsavel').order_by('prazo')[:10]
    
    # Métricas de performance
    processos_concluidos_mes = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        status='CONCLUIDO',
        data_conclusao__month=timezone.now().month,
        data_conclusao__year=timezone.now().year
    ).count()
    
    tempo_medio_conclusao = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        status='CONCLUIDO',
        tempo_total_horas__isnull=False
    ).aggregate(media=Avg('tempo_total_horas'))['media'] or 0
    
    context = {
        'processos_ativos': processos_ativos,
        'processos_atrasados': processos_atrasados,
        'etapas_pendentes': etapas_pendentes,
        'etapas_em_andamento': etapas_em_andamento,
        'processos_por_status': processos_por_status,
        'processos_por_tipo': processos_por_tipo,
        'processos_recentes': processos_recentes,
        'etapas_prazo_proximo': etapas_prazo_proximo,
        'processos_concluidos_mes': processos_concluidos_mes,
        'tempo_medio_conclusao': round(tempo_medio_conclusao, 1),
    }
    
    return render(request, 'workflow/dashboard.html', context)


@login_required
def listar_processos(request):
    """Lista todos os processos de workflow"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    
    # Filtros
    status_filter = request.GET.get('status', '')
    tipo_filter = request.GET.get('tipo', '')
    responsavel_filter = request.GET.get('responsavel', '')
    prioridade_filter = request.GET.get('prioridade', '')
    search = request.GET.get('search', '')
    
    processos = ProcessoWorkflow.objects.filter(gabinete=gabinete)
    
    if status_filter:
        processos = processos.filter(status=status_filter)
    
    if tipo_filter:
        processos = processos.filter(tipo_workflow_id=tipo_filter)
    
    if responsavel_filter:
        processos = processos.filter(responsavel_atual_id=responsavel_filter)
    
    if prioridade_filter:
        processos = processos.filter(prioridade=prioridade_filter)
    
    if search:
        processos = processos.filter(
            Q(titulo__icontains=search) |
            Q(descricao__icontains=search)
        )
    
    processos = processos.select_related(
        'tipo_workflow', 'responsavel_atual', 'criado_por'
    ).order_by('-criado_em')
    
    # Paginação
    paginator = Paginator(processos, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # Dados para filtros
    tipos_workflow = TipoWorkflow.objects.filter(ativo=True)
    usuarios_gabinete = gabinete.usuarios.all()
    
    context = {
        'page_obj': page_obj,
        'tipos_workflow': tipos_workflow,
        'usuarios_gabinete': usuarios_gabinete,
        'status_choices': ProcessoWorkflow.STATUS_CHOICES,
        'prioridade_choices': ProcessoWorkflow.PRIORIDADE_CHOICES,
        'filters': {
            'status': status_filter,
            'tipo': tipo_filter,
            'responsavel': responsavel_filter,
            'prioridade': prioridade_filter,
            'search': search,
        }
    }
    
    return render(request, 'workflow/listar_processos.html', context)


@login_required
def detalhar_processo(request, processo_id):
    """Detalha um processo específico"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    processo = get_object_or_404(ProcessoWorkflow, id=processo_id, gabinete=gabinete)
    
    # Etapas do processo
    etapas = processo.execucoes_etapas.select_related(
        'etapa', 'responsavel', 'aprovado_por'
    ).order_by('etapa__ordem')
    
    # Histórico
    historico = processo.historico.select_related('usuario').order_by('-criado_em')[:20]
    
    # Próxima etapa
    proxima_etapa = etapas.filter(status='PENDENTE').first()
    
    context = {
        'processo': processo,
        'etapas': etapas,
        'historico': historico,
        'proxima_etapa': proxima_etapa,
    }
    
    return render(request, 'workflow/detalhar_processo.html', context)


@login_required
def criar_processo(request):
    """Cria um novo processo de workflow"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    
    if request.method == 'POST':
        form = ProcessoWorkflowForm(request.POST, gabinete=gabinete)
        if form.is_valid():
            processo = form.save(commit=False)
            processo.gabinete = gabinete
            processo.criado_por = request.user
            processo.save()
            
            # Criar execuções das etapas
            for etapa in processo.tipo_workflow.etapas.all():
                ExecucaoEtapa.objects.create(
                    processo=processo,
                    etapa=etapa,
                    prazo=processo.data_inicio + timedelta(days=etapa.prazo_dias),
                    responsavel=etapa.usuario_responsavel
                )
            
            # Registrar no histórico
            HistoricoWorkflow.objects.create(
                processo=processo,
                usuario=request.user,
                acao='CRIACAO',
                descricao=f'Processo criado: {processo.titulo}'
            )
            
            messages.success(request, 'Processo criado com sucesso!')
            return redirect('workflow:detalhar_processo', processo_id=processo.id)
    else:
        form = ProcessoWorkflowForm(gabinete=gabinete)
    
    context = {
        'form': form,
        'titulo': 'Criar Novo Processo'
    }
    
    return render(request, 'workflow/form_processo.html', context)


@login_required
def editar_processo(request, processo_id):
    """Edita um processo existente"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    processo = get_object_or_404(ProcessoWorkflow, id=processo_id, gabinete=gabinete)
    
    if request.method == 'POST':
        form = ProcessoWorkflowForm(request.POST, instance=processo, gabinete=gabinete)
        if form.is_valid():
            processo_anterior = ProcessoWorkflow.objects.get(id=processo.id)
            processo = form.save()
            
            # Registrar mudanças no histórico
            mudancas = []
            if processo_anterior.titulo != processo.titulo:
                mudancas.append(f'Título alterado de "{processo_anterior.titulo}" para "{processo.titulo}"')
            if processo_anterior.status != processo.status:
                mudancas.append(f'Status alterado de "{processo_anterior.get_status_display()}" para "{processo.get_status_display()}"')
            if processo_anterior.prioridade != processo.prioridade:
                mudancas.append(f'Prioridade alterada de "{processo_anterior.get_prioridade_display()}" para "{processo.get_prioridade_display()}"')
            
            if mudancas:
                HistoricoWorkflow.objects.create(
                    processo=processo,
                    usuario=request.user,
                    acao='EDICAO',
                    descricao='; '.join(mudancas)
                )
            
            messages.success(request, 'Processo atualizado com sucesso!')
            return redirect('workflow:detalhar_processo', processo_id=processo.id)
    else:
        form = ProcessoWorkflowForm(instance=processo, gabinete=gabinete)
    
    context = {
        'form': form,
        'processo': processo,
        'titulo': 'Editar Processo'
    }
    
    return render(request, 'workflow/form_processo.html', context)


@login_required
def executar_etapa(request, etapa_id):
    """Executa uma etapa específica"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    etapa = get_object_or_404(
        ExecucaoEtapa, 
        id=etapa_id, 
        processo__gabinete=gabinete
    )
    
    if request.method == 'POST':
        form = ExecucaoEtapaForm(request.POST, instance=etapa)
        if form.is_valid():
            acao = request.POST.get('acao')
            
            if acao == 'iniciar' and etapa.status == 'PENDENTE':
                etapa.iniciar(request.user)
                messages.success(request, 'Etapa iniciada com sucesso!')
                
                HistoricoWorkflow.objects.create(
                    processo=etapa.processo,
                    usuario=request.user,
                    acao='ETAPA_INICIADA',
                    descricao=f'Etapa "{etapa.etapa.nome}" iniciada'
                )
                
            elif acao == 'concluir' and etapa.status == 'EM_ANDAMENTO':
                etapa = form.save(commit=False)
                etapa.concluir(etapa.resultado, request.user)
                messages.success(request, 'Etapa concluída com sucesso!')
                
                HistoricoWorkflow.objects.create(
                    processo=etapa.processo,
                    usuario=request.user,
                    acao='ETAPA_CONCLUIDA',
                    descricao=f'Etapa "{etapa.etapa.nome}" concluída'
                )
            
            return redirect('workflow:detalhar_processo', processo_id=etapa.processo.id)
    else:
        form = ExecucaoEtapaForm(instance=etapa)
    
    context = {
        'form': form,
        'etapa': etapa,
        'processo': etapa.processo
    }
    
    return render(request, 'workflow/executar_etapa.html', context)


@login_required
def minhas_tarefas(request):
    """Lista as tarefas do usuário logado"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    
    # Etapas atribuídas ao usuário
    etapas_pendentes = ExecucaoEtapa.objects.filter(
        processo__gabinete=gabinete,
        responsavel=request.user,
        status='PENDENTE'
    ).select_related('processo', 'etapa').order_by('prazo')
    
    etapas_em_andamento = ExecucaoEtapa.objects.filter(
        processo__gabinete=gabinete,
        responsavel=request.user,
        status='EM_ANDAMENTO'
    ).select_related('processo', 'etapa').order_by('prazo')
    
    # Processos onde é responsável
    processos_responsavel = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        responsavel_atual=request.user,
        status__in=['INICIADO', 'EM_ANDAMENTO']
    ).select_related('tipo_workflow').order_by('prazo_final')
    
    context = {
        'etapas_pendentes': etapas_pendentes,
        'etapas_em_andamento': etapas_em_andamento,
        'processos_responsavel': processos_responsavel,
    }
    
    return render(request, 'workflow/minhas_tarefas.html', context)


@login_required
def relatorios_workflow(request):
    """Relatórios e métricas do workflow"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    
    # Período para análise
    periodo = request.GET.get('periodo', '30')  # dias
    data_inicio = timezone.now() - timedelta(days=int(periodo))
    
    # Processos por status no período
    processos_periodo = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        criado_em__gte=data_inicio
    )
    
    processos_por_status = processos_periodo.values('status').annotate(
        total=Count('id')
    ).order_by('status')
    
    # Processos por tipo
    processos_por_tipo = processos_periodo.values(
        'tipo_workflow__nome'
    ).annotate(
        total=Count('id')
    ).order_by('-total')
    
    # Tempo médio por tipo de workflow
    tempo_medio_por_tipo = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        status='CONCLUIDO',
        tempo_total_horas__isnull=False
    ).values('tipo_workflow__nome').annotate(
        tempo_medio=Avg('tempo_total_horas')
    ).order_by('-tempo_medio')
    
    # Produtividade por usuário
    produtividade_usuarios = ExecucaoEtapa.objects.filter(
        processo__gabinete=gabinete,
        status='CONCLUIDA',
        data_conclusao__gte=data_inicio
    ).values('responsavel__username').annotate(
        etapas_concluidas=Count('id'),
        tempo_medio=Avg('tempo_execucao_horas')
    ).order_by('-etapas_concluidas')
    
    # Processos em atraso
    processos_atrasados = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        prazo_final__lt=timezone.now(),
        status__in=['INICIADO', 'EM_ANDAMENTO']
    ).select_related('tipo_workflow', 'responsavel_atual')
    
    context = {
        'periodo': periodo,
        'processos_por_status': processos_por_status,
        'processos_por_tipo': processos_por_tipo,
        'tempo_medio_por_tipo': tempo_medio_por_tipo,
        'produtividade_usuarios': produtividade_usuarios,
        'processos_atrasados': processos_atrasados,
        'total_processos_periodo': processos_periodo.count(),
    }
    
    return render(request, 'workflow/relatorios.html', context)


@login_required
def api_processos_chart(request):
    """API para dados dos gráficos de processos"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    
    # Processos por mês (últimos 12 meses)
    data_inicio = timezone.now() - timedelta(days=365)
    
    processos_por_mes = ProcessoWorkflow.objects.filter(
        gabinete=gabinete,
        criado_em__gte=data_inicio
    ).extra(
        select={'mes': "strftime('%%Y-%%m', criado_em)"}
    ).values('mes').annotate(
        total=Count('id')
    ).order_by('mes')
    
    # Processos por status
    processos_por_status = ProcessoWorkflow.objects.filter(
        gabinete=gabinete
    ).values('status').annotate(
        total=Count('id')
    )
    
    data = {
        'processos_por_mes': list(processos_por_mes),
        'processos_por_status': list(processos_por_status),
    }
    
    return JsonResponse(data)


@login_required
def cancelar_processo(request, processo_id):
    """Cancela um processo"""
    gabinete = get_object_or_404(Gabinete, usuarios=request.user)
    processo = get_object_or_404(ProcessoWorkflow, id=processo_id, gabinete=gabinete)
    
    if request.method == 'POST':
        motivo = request.POST.get('motivo', '')
        
        processo.status = 'CANCELADO'
        processo.save()
        
        # Cancelar etapas pendentes
        processo.execucoes_etapas.filter(
            status__in=['PENDENTE', 'EM_ANDAMENTO']
        ).update(status='CANCELADA')
        
        # Registrar no histórico
        HistoricoWorkflow.objects.create(
            processo=processo,
            usuario=request.user,
            acao='CANCELAMENTO',
            descricao=f'Processo cancelado. Motivo: {motivo}'
        )
        
        messages.success(request, 'Processo cancelado com sucesso!')
        return redirect('workflow:listar_processos')
    
    context = {
        'processo': processo
    }
    
    return render(request, 'workflow/cancelar_processo.html', context)


# ========================================
# VIEWS PARA TAREFAS (KANBAN)
# ========================================

@login_required
def lista_tarefas(request):
    """Lista todas as tarefas em formato de lista"""
    from .models import Tarefa
    
    gabinete = request.user.gabinete
    
    # Filtros
    status_filter = request.GET.get('status', '')
    prioridade_filter = request.GET.get('prioridade', '')
    responsavel_filter = request.GET.get('responsavel', '')
    search = request.GET.get('search', '')
    
    tarefas = Tarefa.objects.filter(gabinete=gabinete)
    
    if status_filter:
        tarefas = tarefas.filter(status=status_filter)
    
    if prioridade_filter:
        tarefas = tarefas.filter(prioridade=prioridade_filter)
    
    if responsavel_filter:
        tarefas = tarefas.filter(responsavel_id=responsavel_filter)
    
    if search:
        tarefas = tarefas.filter(
            Q(titulo__icontains=search) |
            Q(descricao__icontains=search)
        )
    
    tarefas = tarefas.select_related('responsavel', 'categoria', 'criado_por')
    
    # Paginação
    paginator = Paginator(tarefas, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'status_choices': Tarefa.STATUS_CHOICES,
        'prioridade_choices': Tarefa.PRIORIDADE_CHOICES,
        'usuarios_gabinete': gabinete.usuarios.all(),
        'filters': {
            'status': status_filter,
            'prioridade': prioridade_filter,
            'responsavel': responsavel_filter,
            'search': search,
        }
    }
    
    return render(request, 'workflow/lista_tarefas.html', context)


@login_required
def kanban_tarefas(request):
    """Visualização Kanban das tarefas"""
    from .models import Tarefa
    
    gabinete = request.user.gabinete
    
    # Buscar tarefas por status
    tarefas_pendentes = Tarefa.objects.filter(
        gabinete=gabinete,
        status='PENDENTE'
    ).select_related('responsavel', 'categoria')[:50]
    
    tarefas_andamento = Tarefa.objects.filter(
        gabinete=gabinete,
        status='EM_ANDAMENTO'
    ).select_related('responsavel', 'categoria')[:50]
    
    tarefas_concluidas = Tarefa.objects.filter(
        gabinete=gabinete,
        status='CONCLUIDA'
    ).select_related('responsavel', 'categoria').order_by('-data_conclusao')[:50]
    
    context = {
        'tarefas_pendentes': tarefas_pendentes,
        'tarefas_andamento': tarefas_andamento,
        'tarefas_concluidas': tarefas_concluidas,
    }
    
    return render(request, 'workflow/kanban_tarefas.html', context)


@login_required
def criar_tarefa(request):
    """Cria uma nova tarefa"""
    from .models import Tarefa
    from .forms import TarefaForm
    
    gabinete = request.user.gabinete
    
    if request.method == 'POST':
        form = TarefaForm(request.POST, user=request.user)
        if form.is_valid():
            tarefa = form.save(commit=False)
            tarefa.gabinete = gabinete
            tarefa.criado_por = request.user
            tarefa.save()
            messages.success(request, 'Tarefa criada com sucesso!')
            return redirect('workflow:lista_tarefas')
    else:
        form = TarefaForm(user=request.user)
    
    context = {
        'form': form,
        'titulo': 'Nova Tarefa'
    }
    
    return render(request, 'workflow/form_tarefa.html', context)


@login_required
def detalhe_tarefa(request, tarefa_id):
    """Visualiza detalhes de uma tarefa"""
    from .models import Tarefa
    
    gabinete = request.user.gabinete
    tarefa = get_object_or_404(Tarefa, id=tarefa_id, gabinete=gabinete)
    
    context = {
        'tarefa': tarefa,
    }
    
    return render(request, 'workflow/detalhe_tarefa.html', context)


@login_required
def editar_tarefa(request, tarefa_id):
    """Edita uma tarefa existente"""
    from .models import Tarefa
    from .forms import TarefaForm
    
    gabinete = request.user.gabinete
    tarefa = get_object_or_404(Tarefa, id=tarefa_id, gabinete=gabinete)
    
    if request.method == 'POST':
        form = TarefaForm(request.POST, instance=tarefa, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Tarefa atualizada com sucesso!')
            return redirect('workflow:detalhe_tarefa', tarefa_id=tarefa.id)
    else:
        form = TarefaForm(instance=tarefa, user=request.user)
    
    context = {
        'form': form,
        'tarefa': tarefa,
        'titulo': 'Editar Tarefa'
    }
    
    return render(request, 'workflow/form_tarefa.html', context)


@login_required
def deletar_tarefa(request, tarefa_id):
    """Deleta uma tarefa"""
    from .models import Tarefa
    
    gabinete = request.user.gabinete
    tarefa = get_object_or_404(Tarefa, id=tarefa_id, gabinete=gabinete)
    
    if request.method == 'POST':
        tarefa.delete()
        messages.success(request, 'Tarefa deletada com sucesso!')
        return redirect('workflow:lista_tarefas')
    
    context = {
        'tarefa': tarefa
    }
    
    return render(request, 'workflow/deletar_tarefa.html', context)


@login_required
def iniciar_tarefa(request, tarefa_id):
    """Inicia uma tarefa"""
    from .models import Tarefa
    
    gabinete = request.user.gabinete
    tarefa = get_object_or_404(Tarefa, id=tarefa_id, gabinete=gabinete)
    
    if tarefa.status == 'PENDENTE':
        tarefa.iniciar(request.user)
        messages.success(request, 'Tarefa iniciada com sucesso!')
    else:
        messages.warning(request, 'Esta tarefa não pode ser iniciada.')
    
    return redirect('workflow:detalhe_tarefa', tarefa_id=tarefa.id)


@login_required
def concluir_tarefa(request, tarefa_id):
    """Conclui uma tarefa"""
    from .models import Tarefa
    
    gabinete = request.user.gabinete
    tarefa = get_object_or_404(Tarefa, id=tarefa_id, gabinete=gabinete)
    
    if request.method == 'POST':
        resultado = request.POST.get('resultado', '')
        tarefa.concluir(resultado, request.user)
        messages.success(request, 'Tarefa concluída com sucesso!')
        return redirect('workflow:lista_tarefas')
    
    context = {
        'tarefa': tarefa
    }
    
    return render(request, 'workflow/concluir_tarefa.html', context)


@login_required
def cancelar_tarefa(request, tarefa_id):
    """Cancela uma tarefa"""
    from .models import Tarefa
    
    gabinete = request.user.gabinete
    tarefa = get_object_or_404(Tarefa, id=tarefa_id, gabinete=gabinete)
    
    if request.method == 'POST':
        motivo = request.POST.get('motivo', '')
        tarefa.cancelar(motivo)
        messages.success(request, 'Tarefa cancelada com sucesso!')
        return redirect('workflow:lista_tarefas')
    
    context = {
        'tarefa': tarefa
    }
    
    return render(request, 'workflow/cancelar_tarefa.html', context)