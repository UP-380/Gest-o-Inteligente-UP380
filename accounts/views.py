from django.contrib.auth import login, logout
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import render, redirect
from django.views.generic import TemplateView, ListView, CreateView, UpdateView, DeleteView, DetailView
from django.views import View
from django.db.models import Count, Q
from django.utils import timezone
from django.urls import reverse_lazy
from django.contrib import messages
from datetime import timedelta

from crm.models import Pessoa
from atendimento.models import Atendimento
from documentos.models import Oficio
from agenda.models import Evento
from .models import Assunto, ModeloDocumento, JustificativaPadrao, SolicitacaoPadrao


class CustomLoginView(LoginView):
    """View customizada para login"""
    template_name = 'accounts/login.html'
    redirect_authenticated_user = True

    def get_success_url(self):
        return self.get_redirect_url() or '/accounts/dashboard/'


class CustomLogoutView(View):
    """View customizada para logout que aceita GET"""
    
    def get(self, request):
        logout(request)
        return redirect('/accounts/login/')
    
    def post(self, request):
        logout(request)
        return redirect('/accounts/login/')


class DashboardView(LoginRequiredMixin, TemplateView):
    """Dashboard executivo parlamentar com métricas específicas"""
    template_name = 'dashboard.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        
        # Verificar se o usuário tem gabinete associado
        if not hasattr(user, 'gabinete') or user.gabinete is None:
            # Se não tiver gabinete, retornar contexto vazio
            context.update({
                'atendimentos_abertos': 0,
                'atendimentos_atrasados': 0,
                'oficios_mes': 0,
                'oficios_pendentes': 0,
                'proximos_eventos': 0,
                'eventos_hoje': 0,
                'pessoas_mes': 0,
                'total_cidadaos': 0,
                'atendimentos_mes': 0,
                'atendimentos_resolvidos_mes': 0,
                'taxa_resolucao': 0,
                'tempo_medio_resposta': "0 dias",
                'sessoes_semana': 0,
                'demandas_por_origem': [],
                'atividades_recentes': [],
                'alertas': [{
                    'tipo': 'warning',
                    'icone': 'fas fa-exclamation-triangle',
                    'titulo': 'Gabinete não configurado',
                    'acao': 'Entre em contato com o administrador',
                    'url': '#'
                }],
            })
            return context
        
        gabinete = user.gabinete

        hoje = timezone.now().date()
        inicio_mes = hoje.replace(day=1)
        inicio_ano = hoje.replace(month=1, day=1)
        fim_semana = hoje + timedelta(days=7)

        # === MÉTRICAS PRINCIPAIS ===
        # Atendimentos por status
        atendimentos_abertos = Atendimento.objects.filter(
            gabinete=gabinete,
            status__in=['ABERTO', 'ANDAMENTO']
        ).count()
        
        atendimentos_atrasados = Atendimento.objects.filter(
            gabinete=gabinete,
            status__in=['ABERTO', 'ANDAMENTO'],
            prazo__lt=hoje
        ).count()

        # Documentos parlamentares
        oficios_mes = Oficio.objects.filter(
            gabinete=gabinete,
            data__gte=inicio_mes
        ).count()
        
        oficios_pendentes = Oficio.objects.filter(
            gabinete=gabinete,
            status='RASCUNHO'
        ).count()

        # Agenda parlamentar
        proximos_eventos = Evento.objects.filter(
            gabinete=gabinete,
            inicio__date__gte=hoje,
            inicio__date__lte=fim_semana
        ).count()
        
        eventos_hoje = Evento.objects.filter(
            gabinete=gabinete,
            inicio__date=hoje
        ).count()

        # Relacionamento com cidadãos
        pessoas_mes = Pessoa.objects.filter(
            gabinete=gabinete,
            criado_em__date__gte=inicio_mes
        ).count()
        
        total_cidadaos = Pessoa.objects.filter(gabinete=gabinete).count()

        # === MÉTRICAS PARLAMENTARES ESPECÍFICAS ===
        # Produtividade mensal
        atendimentos_mes = Atendimento.objects.filter(
            gabinete=gabinete,
            criado_em__date__gte=inicio_mes
        ).count()
        
        atendimentos_resolvidos_mes = Atendimento.objects.filter(
            gabinete=gabinete,
            status='FINALIZADO',
            atualizado_em__date__gte=inicio_mes
        ).count()

        # Taxa de resolução
        taxa_resolucao = 0
        if atendimentos_mes > 0:
            taxa_resolucao = round((atendimentos_resolvidos_mes / atendimentos_mes) * 100, 1)

        # Tempo médio de resposta (simulado - pode ser implementado com campos de data)
        tempo_medio_resposta = "2.3 dias"

        # Distribuição por origem de demanda
        demandas_por_origem = Atendimento.objects.filter(
            gabinete=gabinete,
            criado_em__date__gte=inicio_mes
        ).values('origem').annotate(total=Count('id')).order_by('-total')[:5]

        # Eventos parlamentares importantes
        sessoes_semana = Evento.objects.filter(
            gabinete=gabinete,
            tipo__in=['SESSAO_PLENARIA', 'COMISSAO', 'AUDIENCIA_PUBLICA'],
            inicio__date__gte=hoje,
            inicio__date__lte=fim_semana
        ).count()

        # Atividades recentes (últimos 7 dias)
        atividades_recentes = []
        
        # Atendimentos recentes
        atendimentos_recentes = Atendimento.objects.filter(
            gabinete=gabinete,
            criado_em__date__gte=hoje - timedelta(days=7)
        ).order_by('-criado_em')[:3]
        
        for atendimento in atendimentos_recentes:
            atividades_recentes.append({
                'tipo': 'atendimento',
                'icone': 'fas fa-clipboard-list',
                'cor': 'primary',
                'titulo': f'Novo atendimento - {atendimento.protocolo}',
                'descricao': atendimento.assunto[:50] + '...' if len(atendimento.assunto) > 50 else atendimento.assunto,
                'data': atendimento.criado_em
            })

        # Ofícios recentes
        oficios_recentes = Oficio.objects.filter(
            gabinete=gabinete,
            data__gte=hoje - timedelta(days=7)
        ).order_by('-data')[:3]
        
        for oficio in oficios_recentes:
            atividades_recentes.append({
                'tipo': 'oficio',
                'icone': 'fas fa-file-alt',
                'cor': 'success',
                'titulo': f'Ofício {oficio.numero}',
                'descricao': oficio.assunto[:50] + '...' if len(oficio.assunto) > 50 else oficio.assunto,
                'data': oficio.data
            })

        # Ordenar atividades por data
        atividades_recentes.sort(key=lambda x: x['data'], reverse=True)
        atividades_recentes = atividades_recentes[:5]  # Limitar a 5 itens

        # === ALERTAS E PRIORIDADES ===
        alertas = []
        
        if atendimentos_atrasados > 0:
            alertas.append({
                'tipo': 'danger',
                'icone': 'fas fa-exclamation-triangle',
                'titulo': f'{atendimentos_atrasados} atendimento(s) em atraso',
                'acao': 'Ver atendimentos atrasados',
                'url': '/atendimento/?status=ABERTO,ANDAMENTO&atrasado=true'
            })
        
        if eventos_hoje > 0:
            alertas.append({
                'tipo': 'warning',
                'icone': 'fas fa-calendar-day',
                'titulo': f'{eventos_hoje} evento(s) hoje',
                'acao': 'Ver agenda do dia',
                'url': '/agenda/?data=' + hoje.strftime('%Y-%m-%d')
            })
        
        if oficios_pendentes > 0:
            alertas.append({
                'tipo': 'info',
                'icone': 'fas fa-file-signature',
                'titulo': f'{oficios_pendentes} ofício(s) pendente(s)',
                'acao': 'Revisar rascunhos',
                'url': '/documentos/oficios/?status=RASCUNHO'
            })

        context.update({
            # Métricas principais
            'atendimentos_abertos': atendimentos_abertos,
            'atendimentos_atrasados': atendimentos_atrasados,
            'oficios_mes': oficios_mes,
            'oficios_pendentes': oficios_pendentes,
            'proximos_eventos': proximos_eventos,
            'eventos_hoje': eventos_hoje,
            'pessoas_mes': pessoas_mes,
            'total_cidadaos': total_cidadaos,
            
            # Métricas parlamentares
            'atendimentos_mes': atendimentos_mes,
            'atendimentos_resolvidos_mes': atendimentos_resolvidos_mes,
            'taxa_resolucao': taxa_resolucao,
            'tempo_medio_resposta': tempo_medio_resposta,
            'sessoes_semana': sessoes_semana,
            'demandas_por_origem': demandas_por_origem,
            
            # Atividades e alertas
            'atividades_recentes': atividades_recentes,
            'alertas': alertas,
        })

        return context


# ========================================
# VIEWS PARA ASSUNTOS/CATEGORIAS
# ========================================

class AssuntoListView(LoginRequiredMixin, ListView):
    """Lista de assuntos/categorias"""
    model = Assunto
    template_name = 'accounts/assunto_list.html'
    context_object_name = 'assuntos'
    paginate_by = 20

    def get_queryset(self):
        from django.db.models import Q
        queryset = Assunto.objects.filter(
            Q(gabinete=self.request.user.gabinete) | Q(gabinete__isnull=True)
        ).order_by('ordem', 'nome')
        
        search = self.request.GET.get('search', '')
        if search:
            queryset = queryset.filter(nome__icontains=search)
        
        return queryset


class AssuntoCreateView(LoginRequiredMixin, CreateView):
    """Cria novo assunto/categoria"""
    model = Assunto
    template_name = 'accounts/assunto_form.html'
    fields = ['nome', 'descricao', 'cor', 'icone', 'ordem', 'ativo']
    success_url = reverse_lazy('accounts:assunto_list')

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        messages.success(self.request, 'Assunto criado com sucesso!')
        return super().form_valid(form)


class AssuntoUpdateView(LoginRequiredMixin, UpdateView):
    """Edita um assunto existente"""
    model = Assunto
    template_name = 'accounts/assunto_form.html'
    fields = ['nome', 'descricao', 'cor', 'icone', 'ordem', 'ativo']
    success_url = reverse_lazy('accounts:assunto_list')

    def get_queryset(self):
        from django.db.models import Q
        return Assunto.objects.filter(
            Q(gabinete=self.request.user.gabinete) | Q(gabinete__isnull=True)
        )

    def form_valid(self, form):
        messages.success(self.request, 'Assunto atualizado com sucesso!')
        return super().form_valid(form)


class AssuntoDeleteView(LoginRequiredMixin, DeleteView):
    """Deleta um assunto"""
    model = Assunto
    template_name = 'accounts/assunto_confirm_delete.html'
    success_url = reverse_lazy('accounts:assunto_list')

    def get_queryset(self):
        return Assunto.objects.filter(gabinete=self.request.user.gabinete)

    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Assunto deletado com sucesso!')
        return super().delete(request, *args, **kwargs)


# ========================================
# VIEWS PARA MODELOS DE DOCUMENTO
# ========================================

class ModeloDocumentoListView(LoginRequiredMixin, ListView):
    """Lista de modelos de documento"""
    model = ModeloDocumento
    template_name = 'accounts/modelo_list.html'
    context_object_name = 'modelos'
    paginate_by = 20

    def get_queryset(self):
        from django.db.models import Q
        queryset = ModeloDocumento.objects.filter(gabinete=self.request.user.gabinete)
        
        search = self.request.GET.get('search', '')
        tipo = self.request.GET.get('tipo', '')
        
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) | Q(tipo__icontains=search)
            )
        
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        
        return queryset.order_by('tipo', 'nome')


class ModeloDocumentoCreateView(LoginRequiredMixin, CreateView):
    """Cria novo modelo de documento"""
    model = ModeloDocumento
    template_name = 'accounts/modelo_form.html'
    fields = ['nome', 'tipo', 'assunto', 'conteudo', 'cabecalho', 'rodape', 'variaveis_disponiveis', 'ativo']
    success_url = reverse_lazy('accounts:modelo_list')

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        messages.success(self.request, 'Modelo criado com sucesso!')
        return super().form_valid(form)


class ModeloDocumentoUpdateView(LoginRequiredMixin, UpdateView):
    """Edita um modelo existente"""
    model = ModeloDocumento
    template_name = 'accounts/modelo_form.html'
    fields = ['nome', 'tipo', 'assunto', 'conteudo', 'cabecalho', 'rodape', 'variaveis_disponiveis', 'ativo']
    success_url = reverse_lazy('accounts:modelo_list')

    def get_queryset(self):
        return ModeloDocumento.objects.filter(gabinete=self.request.user.gabinete)

    def form_valid(self, form):
        messages.success(self.request, 'Modelo atualizado com sucesso!')
        return super().form_valid(form)


class ModeloDocumentoDeleteView(LoginRequiredMixin, DeleteView):
    """Deleta um modelo"""
    model = ModeloDocumento
    template_name = 'accounts/modelo_confirm_delete.html'
    success_url = reverse_lazy('accounts:modelo_list')

    def get_queryset(self):
        return ModeloDocumento.objects.filter(gabinete=self.request.user.gabinete)

    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Modelo deletado com sucesso!')
        return super().delete(request, *args, **kwargs)


# ========================================
# VIEWS PARA JUSTIFICATIVAS PADRÃO
# ========================================

class JustificativaPadraoListView(LoginRequiredMixin, ListView):
    """Lista de justificativas padrão"""
    model = JustificativaPadrao
    template_name = 'accounts/justificativa_padrao_list.html'
    context_object_name = 'justificativas'
    paginate_by = 20

    def get_queryset(self):
        from django.db.models import Q
        queryset = JustificativaPadrao.objects.filter(gabinete=self.request.user.gabinete)
        
        search = self.request.GET.get('search', '')
        status = self.request.GET.get('status', '')
        
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) | Q(descricao__icontains=search)
            )
        
        if status == 'ativo':
            queryset = queryset.filter(ativo=True)
        elif status == 'inativo':
            queryset = queryset.filter(ativo=False)
        
        return queryset.order_by('nome')


class JustificativaPadraoCreateView(LoginRequiredMixin, CreateView):
    """Cria nova justificativa padrão"""
    model = JustificativaPadrao
    form_class = None  # Será definido no __init__
    template_name = 'accounts/justificativa_padrao_form.html'
    success_url = reverse_lazy('accounts:justificativa_padrao_list')

    def get_form_class(self):
        from .forms import JustificativaPadraoForm
        return JustificativaPadraoForm

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        form.instance.criado_por = self.request.user
        messages.success(self.request, 'Justificativa padrão criada com sucesso!')
        return super().form_valid(form)

    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao criar justificativa padrão. Verifique os campos.')
        return super().form_invalid(form)


class JustificativaPadraoUpdateView(LoginRequiredMixin, UpdateView):
    """Edita uma justificativa padrão existente"""
    model = JustificativaPadrao
    form_class = None  # Será definido no __init__
    template_name = 'accounts/justificativa_padrao_form.html'
    success_url = reverse_lazy('accounts:justificativa_padrao_list')

    def get_form_class(self):
        from .forms import JustificativaPadraoForm
        return JustificativaPadraoForm

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def get_queryset(self):
        return JustificativaPadrao.objects.filter(gabinete=self.request.user.gabinete)

    def form_valid(self, form):
        messages.success(self.request, 'Justificativa padrão atualizada com sucesso!')
        return super().form_valid(form)

    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao atualizar justificativa padrão. Verifique os campos.')
        return super().form_invalid(form)


class JustificativaPadraoDeleteView(LoginRequiredMixin, DeleteView):
    """Deleta uma justificativa padrão"""
    model = JustificativaPadrao
    template_name = 'accounts/justificativa_padrao_confirm_delete.html'
    success_url = reverse_lazy('accounts:justificativa_padrao_list')

    def get_queryset(self):
        return JustificativaPadrao.objects.filter(gabinete=self.request.user.gabinete)

    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Justificativa padrão deletada com sucesso!')
        return super().delete(request, *args, **kwargs)


class JustificativaPadraoDetailView(LoginRequiredMixin, DetailView):
    """Visualiza detalhes de uma justificativa padrão"""
    model = JustificativaPadrao
    template_name = 'accounts/justificativa_padrao_detail.html'
    context_object_name = 'justificativa'

    def get_queryset(self):
        return JustificativaPadrao.objects.filter(gabinete=self.request.user.gabinete)


# ========================================
# VIEWS PARA SOLICITAÇÕES PADRÃO
# ========================================

class SolicitacaoPadraoListView(LoginRequiredMixin, ListView):
    """Lista de solicitações padrão"""
    model = SolicitacaoPadrao
    template_name = 'accounts/solicitacao_padrao_list.html'
    context_object_name = 'solicitacoes'
    paginate_by = 20

    def get_queryset(self):
        from django.db.models import Q
        queryset = SolicitacaoPadrao.objects.filter(gabinete=self.request.user.gabinete)
        
        search = self.request.GET.get('search', '')
        status = self.request.GET.get('status', '')
        
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) | Q(descricao__icontains=search)
            )
        
        if status == 'ativo':
            queryset = queryset.filter(ativo=True)
        elif status == 'inativo':
            queryset = queryset.filter(ativo=False)
        
        return queryset.order_by('nome')


class SolicitacaoPadraoCreateView(LoginRequiredMixin, CreateView):
    """Cria nova solicitação padrão"""
    model = SolicitacaoPadrao
    form_class = None  # Será definido no __init__
    template_name = 'accounts/solicitacao_padrao_form.html'
    success_url = reverse_lazy('accounts:solicitacao_padrao_list')

    def get_form_class(self):
        from .forms import SolicitacaoPadraoForm
        return SolicitacaoPadraoForm

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        form.instance.criado_por = self.request.user
        messages.success(self.request, 'Solicitação padrão criada com sucesso!')
        return super().form_valid(form)

    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao criar solicitação padrão. Verifique os campos.')
        return super().form_invalid(form)


class SolicitacaoPadraoUpdateView(LoginRequiredMixin, UpdateView):
    """Edita uma solicitação padrão existente"""
    model = SolicitacaoPadrao
    form_class = None  # Será definido no __init__
    template_name = 'accounts/solicitacao_padrao_form.html'
    success_url = reverse_lazy('accounts:solicitacao_padrao_list')

    def get_form_class(self):
        from .forms import SolicitacaoPadraoForm
        return SolicitacaoPadraoForm

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def get_queryset(self):
        return SolicitacaoPadrao.objects.filter(gabinete=self.request.user.gabinete)

    def form_valid(self, form):
        messages.success(self.request, 'Solicitação padrão atualizada com sucesso!')
        return super().form_valid(form)

    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao atualizar solicitação padrão. Verifique os campos.')
        return super().form_invalid(form)


class SolicitacaoPadraoDeleteView(LoginRequiredMixin, DeleteView):
    """Deleta uma solicitação padrão"""
    model = SolicitacaoPadrao
    template_name = 'accounts/solicitacao_padrao_confirm_delete.html'
    success_url = reverse_lazy('accounts:solicitacao_padrao_list')

    def get_queryset(self):
        return SolicitacaoPadrao.objects.filter(gabinete=self.request.user.gabinete)

    def delete(self, request, *args, **kwargs):
        messages.success(request, 'Solicitação padrão deletada com sucesso!')
        return super().delete(request, *args, **kwargs)


class SolicitacaoPadraoDetailView(LoginRequiredMixin, DetailView):
    """Visualiza detalhes de uma solicitação padrão"""
    model = SolicitacaoPadrao
    template_name = 'accounts/solicitacao_padrao_detail.html'
    context_object_name = 'solicitacao'

    def get_queryset(self):
        return SolicitacaoPadrao.objects.filter(gabinete=self.request.user.gabinete)

