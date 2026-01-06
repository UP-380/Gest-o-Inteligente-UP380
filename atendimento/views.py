from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import ListView, CreateView, UpdateView, DetailView
from django.db.models import Q
from django.utils import timezone

from .models import Atendimento
from .forms import AtendimentoForm, AtendimentoStatusForm, AtendimentoSearchForm


class AtendimentoListView(LoginRequiredMixin, ListView):
    """Lista de atendimentos do gabinete"""
    model = Atendimento
    template_name = 'atendimento/atendimento_list.html'
    context_object_name = 'atendimentos'
    paginate_by = 20

    def get_queryset(self):
        queryset = Atendimento.objects.filter(gabinete=self.request.user.gabinete)
        
        # Aplicar filtros de busca
        search_form = AtendimentoSearchForm(self.request.GET, user=self.request.user)
        if search_form.is_valid():
            q = search_form.cleaned_data.get('q')
            status = search_form.cleaned_data.get('status')
            prioridade = search_form.cleaned_data.get('prioridade')
            responsavel = search_form.cleaned_data.get('responsavel')
            
            if q:
                queryset = queryset.filter(
                    Q(protocolo__icontains=q) |
                    Q(assunto__icontains=q) |
                    Q(descricao__icontains=q) |
                    Q(pessoa__nome__icontains=q)
                )
            
            if status:
                queryset = queryset.filter(status=status)
            
            if prioridade:
                queryset = queryset.filter(prioridade=prioridade)
            
            if responsavel:
                queryset = queryset.filter(responsavel=responsavel)
        
        return queryset.order_by('-criado_em')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search_form'] = AtendimentoSearchForm(self.request.GET, user=self.request.user)
        return context


class AtendimentoCreateView(LoginRequiredMixin, CreateView):
    """Criar novo atendimento"""
    model = Atendimento
    form_class = AtendimentoForm
    template_name = 'atendimento/atendimento_form.html'

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        form.instance.criado_por = self.request.user
        messages.success(self.request, 'Atendimento criado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        return redirect('atendimento:atendimento_list').url


class AtendimentoUpdateView(LoginRequiredMixin, UpdateView):
    """Editar atendimento existente"""
    model = Atendimento
    form_class = AtendimentoForm
    template_name = 'atendimento/atendimento_form.html'

    def get_queryset(self):
        return Atendimento.objects.filter(gabinete=self.request.user.gabinete)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, 'Atendimento atualizado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        return redirect('atendimento:atendimento_list').url


class AtendimentoDetailView(LoginRequiredMixin, DetailView):
    """Detalhes do atendimento"""
    model = Atendimento
    template_name = 'atendimento/atendimento_detail.html'
    context_object_name = 'atendimento'

    def get_queryset(self):
        return Atendimento.objects.filter(gabinete=self.request.user.gabinete)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['status_form'] = AtendimentoStatusForm(instance=self.object)
        return context


class AtendimentoStatusUpdateView(LoginRequiredMixin, UpdateView):
    """Atualizar status do atendimento"""
    model = Atendimento
    form_class = AtendimentoStatusForm
    template_name = 'atendimento/atendimento_status_form.html'

    def get_queryset(self):
        return Atendimento.objects.filter(gabinete=self.request.user.gabinete)

    def form_valid(self, form):
        messages.success(self.request, 'Status do atendimento atualizado com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        return redirect('atendimento:atendimento_detail', pk=self.object.pk).url









