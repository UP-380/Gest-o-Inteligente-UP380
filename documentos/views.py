import os
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import ListView, CreateView, UpdateView, DetailView, DeleteView
from django.db.models import Q
from django.utils import timezone

from .models import Oficio, Memorando, Destinatario, Requerimento, Indicacao, TipoOrgao
from .utils import gerar_pdf_oficio
from .forms import (
    OficioForm, MemorandoForm, DestinatarioForm, TipoOrgaoForm,
    DocumentoStatusForm, DocumentoSearchForm,
    RequerimentoForm, IndicacaoForm
)


class OficioListView(LoginRequiredMixin, ListView):
    """Lista de ofícios do gabinete"""
    model = Oficio
    template_name = 'documentos/oficio_list.html'
    context_object_name = 'oficios'
    paginate_by = 20

    def get_queryset(self):
        queryset = Oficio.objects.filter(gabinete=self.request.user.gabinete)
        
        # Aplicar filtros de busca
        search_form = DocumentoSearchForm(self.request.GET)
        if search_form.is_valid():
            q = search_form.cleaned_data.get('q')
            status = search_form.cleaned_data.get('status')
            destinatario = search_form.cleaned_data.get('destinatario')
            data_inicio = search_form.cleaned_data.get('data_inicio')
            data_fim = search_form.cleaned_data.get('data_fim')
            
            if q:
                queryset = queryset.filter(
                    Q(numero__icontains=q) |
                    Q(assunto__icontains=q) |
                    Q(corpo__icontains=q) |
                    Q(destinatario__nome__icontains=q)
                )
            
            if status:
                queryset = queryset.filter(status=status)
            
            if destinatario:
                queryset = queryset.filter(destinatario=destinatario)
            
            if data_inicio:
                queryset = queryset.filter(data__gte=data_inicio)
            
            if data_fim:
                queryset = queryset.filter(data__lte=data_fim)
        
        return queryset.order_by('-criado_em')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search_form'] = DocumentoSearchForm(self.request.GET)
        return context


class OficioCreateView(LoginRequiredMixin, CreateView):
    """Criar novo ofício"""
    model = Oficio
    form_class = OficioForm
    template_name = 'documentos/oficio_form.html'

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        form.instance.criado_por = self.request.user
        
        # Salvar o ofício primeiro
        response = super().form_valid(form)
        
        try:
            # Gerar PDF automaticamente
            pdf_path = gerar_pdf_oficio(self.object)
            messages.success(
                self.request, 
                f'Ofício criado com sucesso! PDF gerado automaticamente: {os.path.basename(pdf_path)}'
            )
        except Exception as e:
            messages.warning(
                self.request, 
                f'Ofício criado com sucesso, mas houve erro na geração do PDF: {str(e)}'
            )
        
        return response

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:oficio_list')


class OficioUpdateView(LoginRequiredMixin, UpdateView):
    """Editar ofício existente"""
    model = Oficio
    form_class = OficioForm
    template_name = 'documentos/oficio_form.html'

    def get_queryset(self):
        return Oficio.objects.filter(gabinete=self.request.user.gabinete)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, 'Ofício atualizado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:oficio_list')


class OficioDetailView(LoginRequiredMixin, DetailView):
    """Detalhes do ofício"""
    model = Oficio
    template_name = 'documentos/oficio_detail.html'
    context_object_name = 'oficio'

    def get_queryset(self):
        return Oficio.objects.filter(gabinete=self.request.user.gabinete)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        return context


class OficioStatusUpdateView(LoginRequiredMixin, UpdateView):
    """Atualizar status do ofício"""
    model = Oficio
    form_class = DocumentoStatusForm
    template_name = 'documentos/oficio_status_form.html'

    def get_queryset(self):
        return Oficio.objects.filter(gabinete=self.request.user.gabinete)

    def form_valid(self, form):
        messages.success(self.request, 'Status do ofício atualizado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:oficio_detail', kwargs={'pk': self.object.pk})


class MemorandoListView(LoginRequiredMixin, ListView):
    """Lista de memorandos do gabinete"""
    model = Memorando
    template_name = 'documentos/memorando_list.html'
    context_object_name = 'memorandos'
    paginate_by = 20

    def get_queryset(self):
        queryset = Memorando.objects.filter(gabinete=self.request.user.gabinete)
        
        # Aplicar filtros de busca
        search_form = DocumentoSearchForm(self.request.GET)
        if search_form.is_valid():
            q = search_form.cleaned_data.get('q')
            status = search_form.cleaned_data.get('status')
            destinatario = search_form.cleaned_data.get('destinatario')
            data_inicio = search_form.cleaned_data.get('data_inicio')
            data_fim = search_form.cleaned_data.get('data_fim')
            
            if q:
                queryset = queryset.filter(
                    Q(numero__icontains=q) |
                    Q(assunto__icontains=q) |
                    Q(corpo__icontains=q) |
                    Q(destinatario__nome__icontains=q)
                )
            
            if status:
                queryset = queryset.filter(status=status)
            
            if destinatario:
                queryset = queryset.filter(destinatario=destinatario)
            
            if data_inicio:
                queryset = queryset.filter(data__gte=data_inicio)
            
            if data_fim:
                queryset = queryset.filter(data__lte=data_fim)
        
        return queryset.order_by('-criado_em')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search_form'] = DocumentoSearchForm(self.request.GET)
        return context


class MemorandoCreateView(LoginRequiredMixin, CreateView):
    """Criar novo memorando"""
    model = Memorando
    form_class = MemorandoForm
    template_name = 'documentos/memorando_form.html'

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        form.instance.criado_por = self.request.user
        messages.success(self.request, 'Memorando criado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:memorando_list')


class MemorandoUpdateView(LoginRequiredMixin, UpdateView):
    """Editar memorando existente"""
    model = Memorando
    form_class = MemorandoForm
    template_name = 'documentos/memorando_form.html'

    def get_queryset(self):
        return Memorando.objects.filter(gabinete=self.request.user.gabinete)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, 'Memorando atualizado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:memorando_list')


class MemorandoDetailView(LoginRequiredMixin, DetailView):
    """Detalhes do memorando"""
    model = Memorando
    template_name = 'documentos/memorando_detail.html'
    context_object_name = 'memorando'

    def get_queryset(self):
        return Memorando.objects.filter(gabinete=self.request.user.gabinete)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        return context


class MemorandoStatusUpdateView(LoginRequiredMixin, UpdateView):
    """Atualizar status do memorando"""
    model = Memorando
    form_class = DocumentoStatusForm
    template_name = 'documentos/memorando_status_form.html'

    def get_queryset(self):
        return Memorando.objects.filter(gabinete=self.request.user.gabinete)

    def form_valid(self, form):
        messages.success(self.request, 'Status do memorando atualizado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:memorando_detail', kwargs={'pk': self.object.pk})


class DestinatarioListView(LoginRequiredMixin, ListView):
    """Lista de destinatários padrões"""
    model = Destinatario
    template_name = 'documentos/destinatario_list.html'
    context_object_name = 'destinatarios'
    paginate_by = 20

    def get_queryset(self):
        queryset = Destinatario.objects.all().order_by('nome')
        
        # Busca
        search = self.request.GET.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(cargo__icontains=search) |
                Q(orgao__icontains=search) |
                Q(email__icontains=search)
            )
        
        # Filtro por tipo de órgão
        tipo_filter = self.request.GET.get('tipo_orgao', '')
        if tipo_filter:
            queryset = queryset.filter(tipo_orgao_id=tipo_filter)
        
        # Filtro por nível administrativo
        nivel_filter = self.request.GET.get('nivel', '')
        if nivel_filter:
            queryset = queryset.filter(nivel_administrativo=nivel_filter)
        
        # Filtro por status
        status_filter = self.request.GET.get('status', '')
        if status_filter == 'ativo':
            queryset = queryset.filter(ativo=True)
        elif status_filter == 'inativo':
            queryset = queryset.filter(ativo=False)
        
        return queryset.select_related('tipo_orgao')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['tipos_orgao_list'] = TipoOrgao.objects.filter(ativo=True).order_by('ordem', 'nome')
        context['search'] = self.request.GET.get('search', '')
        context['tipo_filter'] = self.request.GET.get('tipo_orgao', '')
        context['nivel_filter'] = self.request.GET.get('nivel', '')
        context['status_filter'] = self.request.GET.get('status', '')
        return context


class DestinatarioCreateView(LoginRequiredMixin, CreateView):
    """Criar novo destinatário padrão"""
    model = Destinatario
    form_class = DestinatarioForm
    template_name = 'documentos/destinatario_form.html'
    success_url = '/documentos/destinatarios/'

    def form_valid(self, form):
        messages.success(self.request, f'Destinatário "{form.instance.nome}" criado com sucesso!')
        return super().form_valid(form)
    
    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao criar destinatário. Verifique os campos.')
        return super().form_invalid(form)


class DestinatarioUpdateView(LoginRequiredMixin, UpdateView):
    """Editar destinatário padrão existente"""
    model = Destinatario
    form_class = DestinatarioForm
    template_name = 'documentos/destinatario_form.html'
    success_url = '/documentos/destinatarios/'

    def form_valid(self, form):
        messages.success(self.request, f'Destinatário "{form.instance.nome}" atualizado com sucesso!')
        return super().form_valid(form)
    
    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao atualizar destinatário. Verifique os campos.')
        return super().form_invalid(form)


class DestinatarioDeleteView(LoginRequiredMixin, DeleteView):
    """Deletar destinatário padrão"""
    model = Destinatario
    template_name = 'documentos/destinatario_confirm_delete.html'
    success_url = '/documentos/destinatarios/'
    
    def delete(self, request, *args, **kwargs):
        destinatario = self.get_object()
        messages.success(request, f'Destinatário "{destinatario.nome}" removido com sucesso!')
        return super().delete(request, *args, **kwargs)


# ========================================
# VIEWS PARA TIPOS DE ÓRGÃO
# ========================================

class TipoOrgaoListView(LoginRequiredMixin, ListView):
    """Lista de tipos de órgão"""
    model = TipoOrgao
    template_name = 'documentos/tipo_orgao_list.html'
    context_object_name = 'tipos_orgao'
    paginate_by = 20
    
    def get_queryset(self):
        queryset = TipoOrgao.objects.all().order_by('ordem', 'nome')
        
        # Busca
        search = self.request.GET.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(descricao__icontains=search)
            )
        
        # Filtro de status
        status = self.request.GET.get('status', '')
        if status == 'ativo':
            queryset = queryset.filter(ativo=True)
        elif status == 'inativo':
            queryset = queryset.filter(ativo=False)
        
        return queryset
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search'] = self.request.GET.get('search', '')
        context['status_filter'] = self.request.GET.get('status', '')
        return context


class TipoOrgaoCreateView(LoginRequiredMixin, CreateView):
    """Criar novo tipo de órgão"""
    model = TipoOrgao
    form_class = TipoOrgaoForm
    template_name = 'documentos/tipo_orgao_form.html'
    success_url = '/documentos/tipos-orgao/'
    
    def form_valid(self, form):
        messages.success(self.request, f'Tipo de órgão "{form.instance.nome}" criado com sucesso!')
        return super().form_valid(form)
    
    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao criar tipo de órgão. Verifique os campos.')
        return super().form_invalid(form)


class TipoOrgaoUpdateView(LoginRequiredMixin, UpdateView):
    """Editar tipo de órgão"""
    model = TipoOrgao
    form_class = TipoOrgaoForm
    template_name = 'documentos/tipo_orgao_form.html'
    success_url = '/documentos/tipos-orgao/'
    
    def form_valid(self, form):
        messages.success(self.request, f'Tipo de órgão "{form.instance.nome}" atualizado com sucesso!')
        return super().form_valid(form)
    
    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao atualizar tipo de órgão. Verifique os campos.')
        return super().form_invalid(form)


class TipoOrgaoDeleteView(LoginRequiredMixin, DeleteView):
    """Deletar tipo de órgão"""
    model = TipoOrgao
    template_name = 'documentos/tipo_orgao_confirm_delete.html'
    success_url = '/documentos/tipos-orgao/'
    
    def delete(self, request, *args, **kwargs):
        tipo = self.get_object()
        
        # Verificar se há destinatários usando este tipo
        if tipo.destinatarios.exists():
            messages.error(
                request, 
                f'Não é possível excluir "{tipo.nome}" pois existem destinatários associados. '
                'Desative o tipo ao invés de excluí-lo.'
            )
            return redirect('documentos:tipo_orgao_list')
        
        messages.success(request, f'Tipo de órgão "{tipo.nome}" removido com sucesso!')
        return super().delete(request, *args, **kwargs)


# ========================================
# VIEWS PARA REQUERIMENTOS
# ========================================

class RequerimentoListView(LoginRequiredMixin, ListView):
    """Lista de requerimentos do gabinete"""
    model = Requerimento
    template_name = 'documentos/requerimento_list.html'
    context_object_name = 'requerimentos'
    paginate_by = 20

    def get_queryset(self):
        queryset = Requerimento.objects.filter(gabinete=self.request.user.gabinete)
        
        # Filtros
        search = self.request.GET.get('search', '')
        status = self.request.GET.get('status', '')
        tipo = self.request.GET.get('tipo', '')
        
        if search:
            queryset = queryset.filter(
                Q(numero__icontains=search) |
                Q(assunto__icontains=search) |
                Q(corpo__icontains=search)
            )
        
        if status:
            queryset = queryset.filter(status=status)
        
        if tipo:
            queryset = queryset.filter(tipo_requerimento=tipo)
        
        return queryset.select_related('destinatario', 'criado_por').order_by('-data')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search_form'] = DocumentoSearchForm(self.request.GET)
        return context


class RequerimentoDetailView(LoginRequiredMixin, DetailView):
    """Detalhes de um requerimento"""
    model = Requerimento
    template_name = 'documentos/requerimento_detail.html'
    context_object_name = 'requerimento'

    def get_queryset(self):
        return Requerimento.objects.filter(gabinete=self.request.user.gabinete)


class RequerimentoCreateView(LoginRequiredMixin, CreateView):
    """Cria novo requerimento"""
    model = Requerimento
    form_class = RequerimentoForm
    template_name = 'documentos/requerimento_form.html'

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        form.instance.criado_por = self.request.user
        messages.success(self.request, 'Requerimento criado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:requerimento_detail', kwargs={'pk': self.object.pk})


class RequerimentoUpdateView(LoginRequiredMixin, UpdateView):
    """Edita um requerimento existente"""
    model = Requerimento
    form_class = RequerimentoForm
    template_name = 'documentos/requerimento_form.html'

    def get_queryset(self):
        return Requerimento.objects.filter(gabinete=self.request.user.gabinete)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, 'Requerimento atualizado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:requerimento_detail', kwargs={'pk': self.object.pk})


class RequerimentoStatusUpdateView(LoginRequiredMixin, UpdateView):
    """Atualiza apenas o status do requerimento"""
    model = Requerimento
    form_class = DocumentoStatusForm
    template_name = 'documentos/requerimento_status_form.html'

    def get_queryset(self):
        return Requerimento.objects.filter(gabinete=self.request.user.gabinete)

    def form_valid(self, form):
        messages.success(self.request, 'Status do requerimento atualizado!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:requerimento_detail', kwargs={'pk': self.object.pk})


# ========================================
# VIEWS PARA INDICAÇÕES
# ========================================

class IndicacaoListView(LoginRequiredMixin, ListView):
    """Lista de indicações do gabinete"""
    model = Indicacao
    template_name = 'documentos/indicacao_list.html'
    context_object_name = 'indicacoes'
    paginate_by = 20

    def get_queryset(self):
        queryset = Indicacao.objects.filter(gabinete=self.request.user.gabinete)
        
        # Filtros
        search = self.request.GET.get('search', '')
        status = self.request.GET.get('status', '')
        tipo = self.request.GET.get('tipo', '')
        status_execucao = self.request.GET.get('status_execucao', '')
        
        if search:
            queryset = queryset.filter(
                Q(numero__icontains=search) |
                Q(assunto__icontains=search) |
                Q(corpo__icontains=search) |
                Q(municipio__icontains=search) |
                Q(bairro__icontains=search)
            )
        
        if status:
            queryset = queryset.filter(status=status)
        
        if tipo:
            queryset = queryset.filter(tipo_indicacao=tipo)
        
        if status_execucao:
            queryset = queryset.filter(status_execucao=status_execucao)
        
        return queryset.select_related('destinatario', 'criado_por').order_by('-data')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search_form'] = DocumentoSearchForm(self.request.GET)
        return context


class IndicacaoDetailView(LoginRequiredMixin, DetailView):
    """Detalhes de uma indicação"""
    model = Indicacao
    template_name = 'documentos/indicacao_detail.html'
    context_object_name = 'indicacao'

    def get_queryset(self):
        return Indicacao.objects.filter(gabinete=self.request.user.gabinete)


class IndicacaoCreateView(LoginRequiredMixin, CreateView):
    """Cria nova indicação"""
    model = Indicacao
    form_class = IndicacaoForm
    template_name = 'documentos/indicacao_form.html'

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        form.instance.criado_por = self.request.user
        messages.success(self.request, 'Indicação criada com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:indicacao_detail', kwargs={'pk': self.object.pk})


class IndicacaoUpdateView(LoginRequiredMixin, UpdateView):
    """Edita uma indicação existente"""
    model = Indicacao
    form_class = IndicacaoForm
    template_name = 'documentos/indicacao_form.html'

    def get_queryset(self):
        return Indicacao.objects.filter(gabinete=self.request.user.gabinete)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, 'Indicação atualizada com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:indicacao_detail', kwargs={'pk': self.object.pk})


class IndicacaoStatusUpdateView(LoginRequiredMixin, UpdateView):
    """Atualiza apenas o status da indicação"""
    model = Indicacao
    form_class = DocumentoStatusForm
    template_name = 'documentos/indicacao_status_form.html'

    def get_queryset(self):
        return Indicacao.objects.filter(gabinete=self.request.user.gabinete)

    def form_valid(self, form):
        messages.success(self.request, 'Status da indicação atualizado!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('documentos:indicacao_detail', kwargs={'pk': self.object.pk})



