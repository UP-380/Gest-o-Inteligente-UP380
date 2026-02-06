import React, { useRef, useEffect } from 'react';
import { AVATAR_COLORS, DEFAULT_AVATAR, getInitialsFromName } from '../../utils/avatars';
import './ClienteAvatarCard.css';

/**
 * Card para alterar avatar do cliente (abre próximo ao avatar clicado)
 */
const ClienteAvatarCard = ({
  isOpen,
  onClose,
  clienteNome,
  selectedAvatarId,
  onSelectAvatar,
  onUploadPhoto,
  onSave,
  uploading,
  saving
}) => {
  const fileInputRef = useRef(null);
  const cardRef = useRef(null);

  // Fechar card ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target) && isOpen && !uploading && !saving) {
        // Verificar se não é o avatar que abriu o card
        const avatarElement = document.querySelector('.cadastro-cliente-header-icon');
        if (avatarElement && !avatarElement.contains(e.target)) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, uploading, saving, onClose]);

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !uploading && !saving) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, uploading, saving, onClose]);

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Apenas imagens são permitidas (JPEG, JPG, PNG, GIF, WEBP)');
      return;
    }

    // Validar tamanho (15MB máximo)
    if (file.size > 15 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 15MB');
      return;
    }

    if (onUploadPhoto) {
      onUploadPhoto(file);
    }

    // Limpar input
    e.target.value = '';
  };

  const handleSave = () => {
    if (onSave && !saving && !uploading) {
      onSave();
    }
  };

  return (
    <div ref={cardRef} className="cliente-avatar-card">
      <div className="cliente-avatar-card-header">
        <h4>Alterar Foto de Perfil</h4>
        <button
          className="cliente-avatar-card-close"
          onClick={onClose}
          disabled={uploading || saving}
          title="Fechar (ESC)"
        >
          ✕
        </button>
      </div>

      <div className="cliente-avatar-card-body">
        {/* Avatares com Iniciais */}
        <div className="cliente-avatar-card-section">
          <h5 className="cliente-avatar-card-section-title">Avatares com Iniciais</h5>
          <div className="cliente-avatar-card-options-grid">
            {AVATAR_COLORS.map((colorOption) => {
              const isSelected = selectedAvatarId === colorOption.id;
              
              return (
                <div
                  key={colorOption.id}
                  className={`cliente-avatar-card-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (!uploading && !saving && onSelectAvatar) {
                      onSelectAvatar(colorOption.id || DEFAULT_AVATAR);
                    }
                  }}
                  title={colorOption.name}
                >
                  <div
                    className="cliente-avatar-card-preview cliente-avatar-card-preview-color"
                    style={{ background: colorOption.gradient }}
                  >
                    {getInitialsFromName(clienteNome || 'Cliente')}
                  </div>
                  {isSelected && (
                    <div className="cliente-avatar-card-selected-indicator">
                      <i className="fas fa-check-circle"></i>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upload de Foto Personalizada */}
        <div className="cliente-avatar-card-section">
          <h5 className="cliente-avatar-card-section-title">Foto Personalizada</h5>
          <div className="cliente-avatar-card-upload-area">
            <label 
              htmlFor="cliente-avatar-card-file-input" 
              className="cliente-avatar-card-upload-label"
            >
              <i className="fas fa-upload"></i>
              Enviar Foto
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id="cliente-avatar-card-file-input"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              disabled={uploading || saving}
              className="cliente-avatar-card-upload-input"
            />
            <p className="cliente-avatar-card-upload-hint">
              JPEG, PNG, GIF, WEBP (máx. 15MB)
            </p>
            {uploading && (
              <div className="cliente-avatar-card-upload-loading">
                <i className="fas fa-spinner fa-spin"></i>
                Enviando...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cliente-avatar-card-footer">
        <button
          className="cliente-avatar-card-btn-cancel"
          onClick={onClose}
          disabled={uploading || saving}
        >
          Cancelar
        </button>
        <button
          className="cliente-avatar-card-btn-save"
          onClick={handleSave}
          disabled={uploading || saving}
        >
          {saving ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Salvando...
            </>
          ) : (
            <>
              <i className="fas fa-check"></i>
              Salvar
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ClienteAvatarCard;

