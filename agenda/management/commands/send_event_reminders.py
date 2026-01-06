from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import send_mail
from agenda.models import Evento


class Command(BaseCommand):
    help = 'Envia lembretes de eventos que acontecem dentro da janela informada'

    def add_arguments(self, parser):
        parser.add_argument('--minutes', type=int, default=60)

    def handle(self, *args, **opts):
        window = opts['minutes']
        agora = timezone.now()
        ate = agora + timezone.timedelta(minutes=window)

        eventos = Evento.objects.filter(inicio__range=(agora, ate))
        enviados = 0

        for e in eventos:
            assunto = f'Lembrete: {e.titulo} às {e.inicio.astimezone().strftime("%d/%m %H:%M")}'
            corpo = f"""Olá, lembrete de compromisso:

Título: {e.titulo}
Início: {e.inicio.astimezone().strftime("%d/%m/%Y %H:%M")}
Fim: {e.fim.astimezone().strftime("%d/%m/%Y %H:%M")}
Local: {e.local or "-"}
Link: {e.link or "-"}

Equipe +Compliance
"""
            # organizador
            if e.organizador and e.organizador.email:
                send_mail(assunto, corpo, None, [e.organizador.email], fail_silently=True)
                enviados += 1

            # participantes (somente quem tem e-mail)
            for p in e.participantes.all():
                if p.email:
                    send_mail(assunto, corpo, None, [p.email], fail_silently=True)
                    enviados += 1

        self.stdout.write(self.style.SUCCESS(f'Lembretes enviados: {enviados}'))









