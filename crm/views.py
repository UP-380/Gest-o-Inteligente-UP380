from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import ListView, CreateView, UpdateView, DetailView
from django.db.models import Q
from django.core.paginator import Paginator

from .models import Pessoa
from .forms import PessoaForm, PessoaSearchForm


class PessoaListView(LoginRequiredMixin, ListView):
    """Lista de pessoas do gabinete"""
    model = Pessoa
    template_name = 'crm/pessoa_list.html'
    context_object_name = 'pessoas'
    paginate_by = 20

    def get_queryset(self):
        queryset = Pessoa.objects.filter(gabinete=self.request.user.gabinete)
        
        # Aplicar filtros de busca
        search_form = PessoaSearchForm(self.request.GET)
        if search_form.is_valid():
            q = search_form.cleaned_data.get('q')
            tipo = search_form.cleaned_data.get('tipo')
            consentiu_contato = search_form.cleaned_data.get('consentiu_contato')
            
            if q:
                queryset = queryset.filter(
                    Q(nome__icontains=q) |
                    Q(email__icontains=q) |
                    Q(telefone__icontains=q) |
                    Q(cpf__icontains=q) |
                    Q(bairro__icontains=q) |
                    Q(tags__icontains=q)
                )
            
            if tipo:
                queryset = queryset.filter(tipo=tipo)
            
            if consentiu_contato:
                queryset = queryset.filter(consentiu_contato=consentiu_contato == 'True')
        
        return queryset.order_by('nome')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search_form'] = PessoaSearchForm(self.request.GET)
        return context


class PessoaCreateView(LoginRequiredMixin, CreateView):
    """Criar nova pessoa"""
    model = Pessoa
    form_class = PessoaForm
    template_name = 'crm/pessoa_form.html'

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        # Garantir que o gabinete seja definido
        if not form.instance.gabinete:
            form.instance.gabinete = self.request.user.gabinete
        form.instance.criado_por = self.request.user
        messages.success(self.request, 'Pessoa cadastrada com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('crm:pessoa_list')


class PessoaUpdateView(LoginRequiredMixin, UpdateView):
    """Editar pessoa existente"""
    model = Pessoa
    form_class = PessoaForm
    template_name = 'crm/pessoa_form.html'

    def get_queryset(self):
        return Pessoa.objects.filter(gabinete=self.request.user.gabinete)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        messages.success(self.request, 'Pessoa atualizada com sucesso!')
        return super().form_valid(form)

    def get_success_url(self):
        from django.urls import reverse
        return reverse('crm:pessoa_list')


class PessoaDetailView(LoginRequiredMixin, DetailView):
    """Detalhes da pessoa"""
    model = Pessoa
    template_name = 'crm/pessoa_detail.html'
    context_object_name = 'pessoa'

    def get_queryset(self):
        return Pessoa.objects.filter(gabinete=self.request.user.gabinete)


