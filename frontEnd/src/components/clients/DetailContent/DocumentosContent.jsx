import React, { useState, useEffect } from 'react';
import { documentosAPI } from '../../../services/api';
import { useToast } from '../../../hooks/useToast';
import DocumentUploadModal from '../DocumentUploadModal';
import DocumentPreviewModal from '../DocumentPreviewModal';
import './DocumentosContent.css';

const TIPOS_DOCUMENTO = {
  certificado_digital: {
    nome: 'Certificado Digital',
    icone: 'fa-certificate',
    cor: '#f59e0b',
    multiplos: false
  },
  contrato: {
    nome: 'Contrato',
    icone: 'fa-file-contract',
    cor: '#3b82f6',
    multiplos: true
  },
  proposta: {
    nome: 'Proposta',
    icone: 'fa-file-alt',
    cor: '#10b981',
    multiplos: false
  },
  ata_reuniao: {
    nome: 'Ata de Reunião',
    icone: 'fa-file-signature',
    cor: '#8b5cf6',
    multiplos: true
  },
  outros: {
    nome: 'Outros Documentos',
    icone: 'fa-folder',
    cor: '#6b7280',
    multiplos: true
  }
};

// Regex para UUID (formato Supabase/PostgreSQL)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractDocId(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const byKey = doc.id ?? doc.ID ?? doc.document_id ?? doc.uuid;
  if (byKey != null && byKey !== '') return String(byKey);
  for (const value of Object.values(doc)) {
    if (typeof value === 'string' && UUID_REGEX.test(value)) return value;
  }
  return null;
}

function normalizeDocumentos(list) {
  if (!Array.isArray(list)) return [];
  return list.map((doc) => {
    const id = extractDocId(doc);
    return { ...doc, id: id ?? undefined };
  });
}

const DocumentosContent = ({ documentos = [], clienteId, onDocumentoUpdated }) => {
  const showToast = useToast();
  const [documentosState, setDocumentosState] = useState(() => normalizeDocumentos(documentos));
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [tipoUploadSelecionado, setTipoUploadSelecionado] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [documentoPreview, setDocumentoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [documentoEditando, setDocumentoEditando] = useState(null);

  useEffect(() => {
    const normalized = normalizeDocumentos(documentos);
    setDocumentosState(normalized);
    // #region agent log
    if (documentos && documentos.length > 0) {
      const raw = documentos[0];
      const norm = normalized[0];
      fetch('http://127.0.0.1:7242/ingest/0e3f31d6-b926-4309-95c6-37d890fcfa69', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'DocumentosContent.jsx:useEffect-documentos', message: 'documentos received', data: { count: documentos.length, rawKeys: Object.keys(raw), rawId: raw.id, normId: norm?.id, extractId: extractDocId(raw) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2,H3,H5' }) }).catch(() => {});
    }
    // #endregion
  }, [documentos]);

  // Agrupar documentos por tipo
  const documentosAgrupados = documentosState.reduce((acc, doc) => {
    if (!acc[doc.tipo_documento]) {
      acc[doc.tipo_documento] = [];
    }
    acc[doc.tipo_documento].push(doc);
    return acc;
  }, {});

  const handleUploadClick = (tipoDocumento) => {
    setTipoUploadSelecionado(tipoDocumento);
    setShowUploadModal(true);
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    setTipoUploadSelecionado(null);
    if (onDocumentoUpdated) {
      onDocumentoUpdated();
    }
    showToast('success', 'Documento carregado com sucesso!');
  };

  const getDocId = (doc) => doc?.id ?? doc?.ID ?? doc?.document_id ?? extractDocId(doc);

  const handlePreview = async (e, documento) => {
    e?.stopPropagation?.();
    const docId = getDocId(documento);
    if (!docId) {
      showToast('error', 'Documento inválido. Recarregue a página e tente novamente.');
      return;
    }
    try {
      setLoading(true);
      const response = await documentosAPI.getDocumentPreview(String(docId));
      if (response?.success && response?.data?.url_preview) {
        setDocumentoPreview({
          ...documento,
          url_preview: response.data.url_preview
        });
        setShowPreviewModal(true);
      } else {
        showToast('error', 'Não foi possível visualizar este documento');
      }
    } catch (error) {
      console.error('Erro ao obter preview:', error);
      showToast('error', error?.message || 'Erro ao visualizar documento');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (e, documento) => {
    e?.stopPropagation?.();
    const docId = getDocId(documento);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0e3f31d6-b926-4309-95c6-37d890fcfa69', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'DocumentosContent.jsx:handleDownload', message: 'button click', data: { docKeys: documento ? Object.keys(documento) : [], docId: documento?.id, getDocIdResult: docId }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2,H5' }) }).catch(() => {});
    // #endregion
    if (!docId) {
      showToast('error', 'Documento inválido. Recarregue a página e tente novamente.');
      return;
    }
    try {
      setLoading(true);
      const url = await documentosAPI.downloadDocumento(String(docId));
      if (url) {
        window.open(url, '_blank');
      } else {
        showToast('error', 'Não foi possível obter o link de download');
      }
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      showToast('error', error?.message || 'Erro ao fazer download do documento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, documento) => {
    e?.stopPropagation?.();
    const docId = getDocId(documento);
    if (!docId) {
      showToast('error', 'Documento inválido. Recarregue a página e tente novamente.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o documento "${documento.nome_exibicao || 'este documento'}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await documentosAPI.deleteDocumento(String(docId));
      setDocumentosState(prev => prev.filter(d => getDocId(d) !== docId));
      if (onDocumentoUpdated) {
        onDocumentoUpdated();
      }
      showToast('success', 'Documento excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      showToast('error', error?.message || 'Erro ao excluir documento');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (e, documento) => {
    e?.stopPropagation?.();
    const docId = getDocId(documento);
    if (!docId) {
      showToast('error', 'Documento inválido. Recarregue a página e tente novamente.');
      return;
    }
    setDocumentoEditando(documento);
    setTipoUploadSelecionado(documento.tipo_documento);
    setShowUploadModal(true);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
    if (mimeType.includes('image')) return 'fa-file-image';
    return 'fa-file';
  };

  const canPreview = (mimeType) => {
    return mimeType.includes('pdf') || mimeType.includes('image');
  };

  return (
    <div className="documentos-content">
      {/* Grid de Cards por Tipo */}
      <div className="documentos-grid">
        {Object.entries(TIPOS_DOCUMENTO).map(([tipo, info]) => {
          const docsDoTipo = documentosAgrupados[tipo] || [];
          const possuiDocumento = docsDoTipo.length > 0;

          return (
            <div key={tipo} className="documento-tipo-card">
              <div className="documento-tipo-header">
                <div className="documento-tipo-icon" style={{ backgroundColor: `${info.cor}15`, color: info.cor }}>
                  <i className={`fas ${info.icone}`}></i>
                </div>
                <div className="documento-tipo-info">
                  <h3 className="documento-tipo-nome">{info.nome}</h3>
                  <span className="documento-tipo-count">
                    {docsDoTipo.length} {docsDoTipo.length === 1 ? 'documento' : 'documentos'}
                  </span>
                </div>
                <button
                  className="btn-upload-icon"
                  onClick={() => handleUploadClick(tipo)}
                  disabled={loading}
                  title={possuiDocumento && info.multiplos ? 'Adicionar documento' : 'Enviar documento'}
                >
                  <i className="fas fa-upload"></i>
                </button>
              </div>

              {/* Lista de Documentos */}
              {docsDoTipo.length > 0 && (
                <div className="documentos-lista">
                  {docsDoTipo.map((doc, index) => {
                    const docId = getDocId(doc);
                    const docWithId = docId ? { ...doc, id: docId } : doc;
                    return (
                    <div key={docId ?? `doc-${tipo}-${index}`} className="documento-item">
                      <div className="documento-item-icon">
                        <i className={`fas ${getFileIcon(doc.mime_type)}`}></i>
                      </div>
                      <div className="documento-item-info">
                        <div className="documento-item-nome">{doc.nome_exibicao}</div>
                        <div className="documento-item-meta">
                          <span>{formatFileSize(doc.tamanho_bytes)}</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {doc.descricao && (
                          <div className="documento-item-descricao">{doc.descricao}</div>
                        )}
                      </div>
                      <div className="documento-item-actions">
                        {canPreview(doc.mime_type) && (
                          <button
                            type="button"
                            className="btn-action btn-preview"
                            onClick={(ev) => handlePreview(ev, docWithId)}
                            title="Visualizar"
                            disabled={loading}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-action btn-download"
                          onClick={(ev) => handleDownload(ev, docWithId)}
                          title="Download"
                          disabled={loading}
                        >
                          <i className="fas fa-download"></i>
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-edit"
                          onClick={(ev) => handleEdit(ev, docWithId)}
                          title="Editar"
                          disabled={loading}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-delete"
                          onClick={(ev) => handleDelete(ev, docWithId)}
                          title="Excluir"
                          disabled={loading}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {docsDoTipo.length === 0 && (
                <div className="documento-empty">
                  <i className="fas fa-file"></i>
                  <p>Nenhum documento cadastrado</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modais */}
      {showUploadModal && (
        <DocumentUploadModal
          clienteId={clienteId}
          tipoDocumento={tipoUploadSelecionado}
          documentoExistente={documentoEditando}
          onClose={() => {
            setShowUploadModal(false);
            setTipoUploadSelecionado(null);
            setDocumentoEditando(null);
          }}
          onSuccess={handleUploadSuccess}
        />
      )}

      {showPreviewModal && documentoPreview && (
        <DocumentPreviewModal
          documento={documentoPreview}
          onClose={() => {
            setShowPreviewModal(false);
            setDocumentoPreview(null);
          }}
          onDownload={() => handleDownload(null, documentoPreview)}
        />
      )}
    </div>
  );
};

export default DocumentosContent;
