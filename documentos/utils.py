import os
from django.conf import settings
from django.http import HttpResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT


def gerar_pdf_oficio(oficio):
    """Gera PDF do ofício usando ReportLab"""
    
    # Criar diretório se não existir
    pdf_dir = os.path.join(settings.MEDIA_ROOT, 'pdfs', str(oficio.data.year), str(oficio.data.month))
    os.makedirs(pdf_dir, exist_ok=True)
    
    # Nome do arquivo
    pdf_filename = f'oficio_{oficio.numero}.pdf'
    pdf_path = os.path.join(pdf_dir, pdf_filename)
    
    # Criar documento PDF
    doc = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    
    # Estilos personalizados
    titulo_style = ParagraphStyle(
        'Titulo',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Times-Bold'
    )
    
    subtitulo_style = ParagraphStyle(
        'Subtitulo',
        parent=styles['Normal'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName='Times-Roman'
    )
    
    numero_style = ParagraphStyle(
        'Numero',
        parent=styles['Normal'],
        fontSize=12,
        alignment=TA_CENTER,
        spaceAfter=30,
        fontName='Times-Roman'
    )
    
    destinatario_style = ParagraphStyle(
        'Destinatario',
        parent=styles['Normal'],
        fontSize=12,
        alignment=TA_LEFT,
        spaceAfter=20,
        fontName='Times-Bold'
    )
    
    dados_style = ParagraphStyle(
        'Dados',
        parent=styles['Normal'],
        fontSize=12,
        alignment=TA_LEFT,
        spaceAfter=20,
        leftIndent=1*cm,
        fontName='Times-Roman'
    )
    
    corpo_style = ParagraphStyle(
        'Corpo',
        parent=styles['Normal'],
        fontSize=12,
        alignment=TA_JUSTIFY,
        spaceAfter=20,
        fontName='Times-Roman'
    )
    
    assinatura_style = ParagraphStyle(
        'Assinatura',
        parent=styles['Normal'],
        fontSize=12,
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName='Times-Bold'
    )
    
    # Conteúdo do PDF
    story = []
    
    # Cabeçalho
    story.append(Paragraph(oficio.gabinete.parlamentar_nome or "PARLAMENTAR", titulo_style))
    story.append(Paragraph(f"{oficio.gabinete.cargo or 'VEREADOR'} - {oficio.gabinete.municipio or 'MUNICÍPIO'}/{oficio.gabinete.estado or 'UF'}", subtitulo_style))
    story.append(Paragraph(f"OFÍCIO Nº {oficio.numero}", numero_style))
    
    # Linha separadora
    story.append(Spacer(1, 0.5*cm))
    
    # Destinatário
    story.append(Paragraph("Exmo(a). Sr(a).", destinatario_style))
    
    dados_destinatario = f"""
    <b>{oficio.destinatario.nome}</b><br/>
    {oficio.destinatario.cargo}<br/>
    {oficio.destinatario.orgao}<br/>
    """
    
    if oficio.destinatario.endereco:
        dados_destinatario += f"{oficio.destinatario.endereco}<br/>"
    
    dados_destinatario += f"{oficio.destinatario.municipio}/{oficio.destinatario.uf}"
    
    story.append(Paragraph(dados_destinatario, dados_style))
    story.append(Spacer(1, 1*cm))
    
    # Corpo do documento
    story.append(Paragraph(oficio.corpo.replace('\n', '<br/>'), corpo_style))
    
    # Observações se houver
    if oficio.observacoes:
        story.append(Spacer(1, 0.5*cm))
        story.append(Paragraph(f"<b>Observações:</b><br/>{oficio.observacoes.replace(chr(10), '<br/>')}", corpo_style))
    
    # Espaço para assinatura
    story.append(Spacer(1, 3*cm))
    
    # Linha de assinatura
    linha_assinatura = Table([['']], colWidths=[8*cm], rowHeights=[1*cm])
    linha_assinatura.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (0, 0), 1, colors.black),
    ]))
    story.append(linha_assinatura)
    
    # Nome e cargo
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(oficio.gabinete.parlamentar_nome or "PARLAMENTAR", assinatura_style))
    story.append(Paragraph(oficio.gabinete.cargo or "VEREADOR", assinatura_style))
    
    # Rodapé com informações adicionais
    story.append(Spacer(1, 1*cm))
    rodape_info = f"""
    <b>Data:</b> {oficio.data.strftime('%d/%m/%Y')}<br/>
    """
    
    if oficio.pessoa_interessada:
        rodape_info += f"<b>Pessoa Interessada:</b> {oficio.pessoa_interessada.nome}<br/>"
    
    if oficio.responsavel:
        rodape_info += f"<b>Responsável:</b> {oficio.responsavel.get_full_name()}<br/>"
    
    rodape_info += f"<b>Status:</b> {oficio.get_status_display()}"
    
    story.append(Paragraph(rodape_info, ParagraphStyle(
        'Rodape',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_LEFT,
        fontName='Times-Roman'
    )))
    
    # Construir PDF
    doc.build(story)
    
    # Atualizar o campo arquivo do ofício
    relative_path = os.path.relpath(pdf_path, settings.MEDIA_ROOT)
    oficio.arquivo.name = relative_path
    oficio.save()
    
    return pdf_path


def gerar_resposta_pdf(pdf_path, filename):
    """Gera resposta HTTP para download do PDF"""
    
    with open(pdf_path, 'rb') as pdf_file:
        response = HttpResponse(pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
