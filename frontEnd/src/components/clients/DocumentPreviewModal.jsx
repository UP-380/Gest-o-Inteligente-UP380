import React, { useState, useEffect } from 'react';
import './DocumentPreviewModal.css';

const DocumentPreviewModal = ({ documento, onClose, onDownload }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (documento?.url_preview) {
      setLoading(false);
    }
  }, [documento]);

  const isPDF = documento?.mime_type?.includes('pdf');
  const isImage = documento?.mime_type?.includes('image');

  const handleIframeLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError('Erro ao carregar o documento');
  };

  const handleImageLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleImageError = () => {
    setLoading(false);
    setError('Erro ao carregar a imagem');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content documento-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fas fa-file"></i>
            {documento?.nome_exibicao || 'Visualizar Documento'}
          </h3>
          <div className="modal-header-actions">
            {onDownload && (
              <button
                type="button"
                className="btn-icon btn-download"
                onClick={onDownload}
                title="Download"
              >
                <i className="fas fa-download"></i>
              </button>
            )}
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Fechar"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="modal-body documento-preview-body">
          {loading && (
            <div className="preview-loading">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Carregando documento...</p>
            </div>
          )}

          {error && (
            <div className="preview-error">
              <i className="fas fa-exclamation-triangle"></i>
              <p>{error}</p>
              {onDownload && (
                <button className="btn-primary" onClick={onDownload}>
                  <i className="fas fa-download"></i>
                  Fazer Download
                </button>
              )}
            </div>
          )}

          {!error && documento?.url_preview && (
            <>
              {isPDF && (
                <iframe
                  src={documento.url_preview}
                  className="preview-iframe"
                  title="Preview do documento"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  style={{ display: loading ? 'none' : 'block' }}
                />
              )}

              {isImage && (
                <img
                  src={documento.url_preview}
                  alt={documento.nome_exibicao}
                  className="preview-image"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  style={{ display: loading ? 'none' : 'block' }}
                />
              )}

              {!isPDF && !isImage && (
                <div className="preview-not-supported">
                  <i className="fas fa-file"></i>
                  <p>Visualização não disponível para este tipo de arquivo</p>
                  {onDownload && (
                    <button className="btn-primary" onClick={onDownload}>
                      <i className="fas fa-download"></i>
                      Fazer Download
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {documento?.descricao && (
            <div className="preview-description">
              <strong>Descrição:</strong>
              <p>{documento.descricao}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="preview-meta">
            {documento?.tamanho_bytes && (
              <span>
                <i className="fas fa-weight"></i>
                {formatFileSize(documento.tamanho_bytes)}
              </span>
            )}
            {documento?.created_at && (
              <span>
                <i className="fas fa-calendar"></i>
                {new Date(documento.created_at).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export default DocumentPreviewModal;
