"""
URL configuration for mais_compliance project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', RedirectView.as_view(url='/accounts/dashboard/', permanent=False), name='home'),
    path('accounts/', include('accounts.urls')),
    path('crm/', include('crm.urls')),
    path('atendimento/', include('atendimento.urls')),
    path('documentos/', include('documentos.urls')),
    path('agenda/', include('agenda.urls')),
    path('workflow/', include('workflow.urls')),
    path('api/', include('api.urls')),
    path('portal/', include('portal.urls')),  # Portal do Cidadão
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
