from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView, ListView, CreateView, UpdateView
from django.urls import reverse_lazy
from django.http import JsonResponse
from django.utils import timezone
from django.contrib import messages
from .models import Evento
from .forms import EventoForm


class AgendaCalendarioView(LoginRequiredMixin, TemplateView):
    template_name = 'agenda/calendario.html'


class EventoList(LoginRequiredMixin, ListView):
    model = Evento
    paginate_by = 20
    ordering = ('-inicio',)
    template_name = 'agenda/evento_list.html'

    def get_queryset(self):
        return (Evento.objects
                .filter(gabinete=self.request.user.gabinete)
                .order_by('-inicio'))


class EventoCreate(LoginRequiredMixin, CreateView):
    model = Evento
    form_class = EventoForm
    template_name = 'agenda/evento_form.html'
    success_url = reverse_lazy('agenda:lista')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def form_valid(self, form):
        form.instance.gabinete = self.request.user.gabinete
        form.instance.organizador = self.request.user
        response = super().form_valid(form)
        messages.success(self.request, f'Evento "{form.instance.titulo}" criado com sucesso!')
        return response
    
    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao criar evento. Verifique os dados informados.')
        return super().form_invalid(form)


class EventoUpdate(LoginRequiredMixin, UpdateView):
    model = Evento
    form_class = EventoForm
    template_name = 'agenda/evento_form.html'
    success_url = reverse_lazy('agenda:lista')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs
    
    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, f'Evento "{form.instance.titulo}" atualizado com sucesso!')
        return response
    
    def form_invalid(self, form):
        messages.error(self.request, 'Erro ao atualizar evento. Verifique os dados informados.')
        return super().form_invalid(form)


# API JSON para o FullCalendar
def eventos_json(request):
    user = request.user
    if not user.is_authenticated:
        return JsonResponse([], safe=False)

    inicio = request.GET.get('start')  # ISO8601
    fim = request.GET.get('end')
    qs = Evento.objects.filter(gabinete=user.gabinete)
    if inicio and fim:
        qs = qs.filter(inicio__lte=fim, fim__gte=inicio)

    data = [{
        "id": e.id,
        "title": f"{e.titulo}",
        "start": e.inicio.isoformat(),
        "end": e.fim.isoformat(),
        "url": reverse_lazy('agenda:editar', kwargs={"pk": e.pk}),
    } for e in qs]
    return JsonResponse(data, safe=False)
