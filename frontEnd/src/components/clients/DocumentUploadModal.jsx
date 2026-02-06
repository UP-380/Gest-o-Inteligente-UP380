import React, { useState, useRef } from 'react';
import { documentosAPI } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import './DocumentUploadModal.css';

const TIPOS_DOCUMENTO = {
  certificado_digital: { nome: 'Certificado Digital', icone: 'fa-certificate' },
  contrato: { nome: 'Contrato', icone: 'fa-file-contract' },
  proposta: { nome: 'Proposta', icone: 'fa-file-alt' },
  ata_reuniao: { nome: 'Ata de Reunião', icone: 'fa-file-signature' },
  outros: { nome: 'Outros Documentos', icone: 'fa-folder' }
};

const DocumentUploadModal = ({ clienteId, tipoDocumento, documentoExistente, onClose, onSuccess }) => {
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [nomeExibicao, setNomeExibicao] = useState(documentoExistente?.nome_exibicao || '');
  const [descricao, setDescricao] = useState(documentoExistente?.descricao || '');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const tipoInfo = TIPOS_DOCUMENTO[tipoDocumento] || { nome: 'Documento', icone: 'fa-file' };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file) => {
    // Validar tamanho (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('error', 'Arquivo muito grande. Tamanho máximo: 50MB');
      return;
    }

    // Validar tipo
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif'
    ];

    if (!allowedTypes.includes(file.type)) {
      showToast('error', 'Tipo de arquivo não permitido. Tipos permitidos: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, GIF');
      return;
    }

    setArquivo(file);
    if (!nomeExibicao) {
      setNomeExibicao(file.name);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!arquivo && !documentoExistente) {
      showToast('error', 'Selecione um arquivo');
      return;
    }

    if (!nomeExibicao.trim()) {
      showToast('error', 'Nome do documento é obrigatório');
      return;
    }

    try {
      setUploading(true);

      if (documentoExistente) {
        // Atualizar documento existente
        await documentosAPI.updateDocumento(documentoExistente.id, {
          nome_exibicao: nomeExibicao.trim(),
          descricao: descricao.trim() || null
        });
        showToast('success', 'Documento atualizado com sucesso!');
      } else {
        // Upload de novo documento
        const formData = new FormData();
        formData.append('arquivo', arquivo);
        formData.append('tipo_documento', tipoDocumento);
        formData.append('nome_exibicao', nomeExibicao.trim());
        if (descricao.trim()) {
          formData.append('descricao', descricao.trim());
        }

        await documentosAPI.uploadDocumento(clienteId, formData);
        showToast('success', 'Documento carregado com sucesso!');
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showToast('error', error.message || 'Erro ao fazer upload do documento');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('pdf')) return 'fa-file-pdf';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return 'fa-file-word';
    if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return 'fa-file-excel';
    if (mimeType?.includes('image')) return 'fa-file-image';
    return 'fa-file';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content documento-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className={`fas ${tipoInfo.icone}`}></i>
            {documentoExistente ? 'Editar Documento' : `Enviar ${tipoInfo.nome}`}
          </h3>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={uploading}
            aria-label="Fechar"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Área de Upload */}
            {!documentoExistente && (
              <div
                className={`upload-area ${dragActive ? 'drag-active' : ''} ${arquivo ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {arquivo ? (
                  <div className="upload-file-preview">
                    <i className={`fas ${getFileIcon(arquivo.type)}`}></i>
                    <div className="upload-file-info">
                      <div className="upload-file-name">{arquivo.name}</div>
                      <div className="upload-file-size">{formatFileSize(arquivo.size)}</div>
                    </div>
                    <button
                      type="button"
                      className="btn-remove-file"
                      onClick={(e) => {
                        e.stopPropagation();
                        setArquivo(null);
                      }}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <p>Arraste o arquivo aqui ou clique para selecionar</p>
                    <span className="upload-hint">PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, GIF (máx. 50MB)</span>
                  </div>
                )}
              </div>
            )}

            {/* Informações do Documento Existente */}
            {documentoExistente && (
              <div className="documento-existente-info">
                <div className="documento-existente-item">
                  <i className={`fas ${getFileIcon(documentoExistente.mime_type)}`}></i>
                  <div>
                    <div className="documento-existente-nome">{documentoExistente.nome_arquivo}</div>
                    <div className="documento-existente-meta">
                      {formatFileSize(documentoExistente.tamanho_bytes)} • {new Date(documentoExistente.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Campos do Formulário */}
            <div className="form-group">
              <label htmlFor="nome_exibicao">
                Nome do Documento <span className="required">*</span>
              </label>
              <input
                id="nome_exibicao"
                type="text"
                value={nomeExibicao}
                onChange={(e) => setNomeExibicao(e.target.value)}
                placeholder="Digite o nome do documento"
                required
                disabled={uploading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="descricao">Descrição (opcional)</label>
              <textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Digite uma descrição para o documento"
                rows={3}
                disabled={uploading}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={uploading || (!arquivo && !documentoExistente)}
            >
              {uploading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  {documentoExistente ? 'Salvando...' : 'Enviando...'}
                </>
              ) : (
                <>
                  <i className="fas fa-check"></i>
                  {documentoExistente ? 'Salvar' : 'Enviar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentUploadModal;
