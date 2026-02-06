import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import PageHeader from '../../components/common/PageHeader';
import ImageCropModal from '../../components/user/ImageCropModal';
import { getAllAvatarOptions, isColorAvatar, isImageAvatar, isCustomAvatar, getAvatarColor, getAvatarImagePath, getInitialsFromName, DEFAULT_AVATAR } from '../../utils/avatars';
import './ConfiguracoesPerfil.css';

const ConfiguracoesPerfil = () => {
  const { usuario, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nome_usuario: '',
    email_usuario: '',
    foto_perfil: DEFAULT_AVATAR,
    senha_atual: '',
    senha_nova: '',
    senha_confirmacao: '',
    uploadedAvatarPath: null // Caminho temporário da foto uploadada
  });

  const [showPasswords, setShowPasswords] = useState({
    senha_atual: false,
    senha_nova: false,
    senha_confirmacao: false
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [customAvatarPath, setCustomAvatarPath] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);

  useEffect(() => {
    // Carregar dados do usuário
    const getUserData = () => {
      if (usuario) {
        return usuario;
      }
      
      try {
        const usuarioStorage = localStorage.getItem('usuario');
        if (usuarioStorage) {
          return JSON.parse(usuarioStorage);
        }
      } catch (error) {
        console.error('Erro ao ler dados do usuário:', error);
      }
      
      return null;
    };

    const userData = getUserData();
    if (userData) {
      setFormData({
        nome_usuario: userData.nome_usuario || '',
        email_usuario: userData.email_usuario || '',
        foto_perfil: userData.foto_perfil || DEFAULT_AVATAR,
        senha_atual: '',
        senha_nova: '',
        senha_confirmacao: '',
        uploadedAvatarPath: null
      });
      
      // Avatar customizado é resolvido automaticamente pelo componente Avatar via Supabase Storage
      // Não precisamos mais de foto_perfil_path
    }
  }, [usuario]);

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Função para exibir toast notifications
  const showToast = (type, message) => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast--error' : 'toast--success'}`;
    
    const icon = document.createElement('i');
    icon.className = `toast-icon fas ${type === 'error' ? 'fa-times-circle' : 'fa-check-circle'}`;
    
    const msg = document.createElement('div');
    msg.className = 'toast-text';
    msg.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(msg);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    }, type === 'error' ? 3000 : 2000);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('error', 'Apenas imagens são permitidas (JPEG, JPG, PNG, GIF, WEBP)');
      return;
    }

    // Validar tamanho (15MB máximo)
    if (file.size > 15 * 1024 * 1024) {
      showToast('error', 'A imagem deve ter no máximo 15MB');
      return;
    }

    // Criar preview e abrir modal de crop
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    // Limpar input
    e.target.value = '';
  };

  const handleCropComplete = async (croppedFile) => {
    setShowCropModal(false);
    setUploadingAvatar(true);

    try {
      const result = await authAPI.uploadAvatar(croppedFile);
      
      if (result.success) {
        // Apenas salvar o preview localmente, sem atualizar o banco ou contexto
        setCustomAvatarPath(result.imagePath);
        setAvatarPreview(URL.createObjectURL(croppedFile));
        
        // Armazenar o arquivo e caminho temporariamente para salvar depois
        setFormData(prev => ({
          ...prev,
          foto_perfil: result.usuario.foto_perfil,
          uploadedAvatarPath: result.imagePath // Caminho temporário
        }));
        
        showToast('success', 'Foto carregada! Clique em "Salvar Alterações" para confirmar.');
      } else {
        throw new Error(result.error || 'Erro ao fazer upload');
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showToast('error', error.message || 'Erro ao fazer upload da imagem. Tente novamente.');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      setImageToCrop(null);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAvatarDoubleClick = (option) => {
    setPreviewAvatar(option);
  };

  const closePreviewModal = () => {
    setPreviewAvatar(null);
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar nome
    if (!formData.nome_usuario || !formData.nome_usuario.trim()) {
      newErrors.nome_usuario = 'Nome de usuário é obrigatório';
    } else if (formData.nome_usuario.trim().length < 2) {
      newErrors.nome_usuario = 'Nome deve ter pelo menos 2 caracteres';
    }

    // Validar senha (se fornecida)
    const querMudarSenha = formData.senha_nova || formData.senha_confirmacao || formData.senha_atual;
    
    if (querMudarSenha) {
      // Se quer mudar senha, senha atual é obrigatória
      if (!formData.senha_atual || !formData.senha_atual.trim()) {
        newErrors.senha_atual = 'Senha atual é obrigatória para alterar a senha';
      }

      // Se forneceu senha atual, deve fornecer nova senha
      if (formData.senha_atual && !formData.senha_nova) {
        newErrors.senha_nova = 'Digite a nova senha';
      }

      // Validar nova senha
      if (formData.senha_nova) {
        if (formData.senha_nova.length < 6) {
          newErrors.senha_nova = 'Nova senha deve ter pelo menos 6 caracteres';
        } else if (formData.senha_nova !== formData.senha_confirmacao) {
          newErrors.senha_confirmacao = 'As senhas não coincidem';
        }
      }

      // Se forneceu confirmação, deve fornecer nova senha também
      if (formData.senha_confirmacao && !formData.senha_nova) {
        newErrors.senha_nova = 'Digite a nova senha para confirmar';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const isValid = validateForm();
    if (!isValid) {
      return;
    }

    setLoading(true);

    try {
      // Preparar dados para salvar
      // Se houver foto uploadada, usar ela; caso contrário, usar a selecionada
      const fotoPerfilParaSalvar = formData.uploadedAvatarPath 
        ? formData.foto_perfil // Se uploadou foto personalizada, usar o ID custom-{userId}
        : (formData.foto_perfil || DEFAULT_AVATAR);
      
      const dadosParaSalvar = {
        nome_usuario: formData.nome_usuario.trim(),
        foto_perfil: fotoPerfilParaSalvar
      };

      // Adicionar senhas apenas se foram fornecidas
      // IMPORTANTE: Se forneceu nova senha, DEVE fornecer senha atual também
      if (formData.senha_nova && formData.senha_nova.trim()) {
        // Se forneceu nova senha mas não forneceu senha atual, erro
        if (!formData.senha_atual || !formData.senha_atual.trim()) {
          setErrors({ senha_atual: 'Senha atual é obrigatória para alterar a senha' });
          setLoading(false);
          return;
        }
        
        dadosParaSalvar.senha_atual = formData.senha_atual.trim();
        dadosParaSalvar.senha_nova = formData.senha_nova.trim();
      }

      // Chamar API para atualizar perfil
      const result = await authAPI.updateProfile(dadosParaSalvar);

      if (result.success) {
        // Atualizar localStorage com os novos dados
        if (result.usuario) {
          localStorage.setItem('usuario', JSON.stringify(result.usuario));
        }

        // Atualizar contexto de autenticação (isso recarrega a foto automaticamente)
        await checkAuth();
        
        // Avatar é resolvido automaticamente pelo componente Avatar via Supabase Storage

        // Atualizar formData com os novos dados e limpar campos de senha e foto uploadada
        setFormData(prev => ({
          ...prev,
          nome_usuario: result.usuario?.nome_usuario || prev.nome_usuario,
          foto_perfil: result.usuario?.foto_perfil || prev.foto_perfil,
          senha_atual: '',
          senha_nova: '',
          senha_confirmacao: '',
          uploadedAvatarPath: null // Limpar caminho temporário após salvar
        }));
        
        // Limpar preview da foto uploadada
        setAvatarPreview(null);
        setCustomAvatarPath(null);

        // Mostrar mensagem de sucesso
        showToast('success', 'Perfil atualizado com sucesso!');
        
        // Redirecionar para a página anterior após um pequeno delay para mostrar o toast
        setTimeout(() => {
          navigate(-1); // Volta para a página anterior
        }, 1500); // 1.5 segundos para o usuário ver a mensagem de sucesso
      } else {
        throw new Error(result.error || 'Erro ao atualizar perfil');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showToast('error', error.message || 'Erro ao salvar configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <PageHeader 
            title="Configurações de Perfil"
            subtitle="Gerencie suas informações pessoais"
          />

          <div className="configuracoes-perfil-content">
            <CardContainer className="config-section">
              <h3 className="config-section-title">
                <i className="fas fa-user"></i>
                Informações do Usuário
              </h3>
              
              <form onSubmit={handleSubmit} className="config-form">
                <div className="config-form-grid">
                  <div className="config-form-group">
                    <label className="config-label">
                      Nome de Usuário <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className={`config-input ${errors.nome_usuario ? 'error' : ''}`}
                      value={formData.nome_usuario}
                      onChange={(e) => handleInputChange('nome_usuario', e.target.value)}
                      placeholder="Seu nome completo"
                      disabled={loading}
                    />
                    {errors.nome_usuario && (
                      <span className="config-error">{errors.nome_usuario}</span>
                    )}
                  </div>

                  <div className="config-form-group">
                    <label className="config-label">
                      Email <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      className="config-input"
                      value={formData.email_usuario}
                      placeholder="seu@email.com"
                      disabled={true}
                    />
                    <span className="config-hint">
                      O email não pode ser alterado. Entre em contato com o administrador para alterar.
                    </span>
                  </div>
                </div>

                {/* Seção de Foto de Perfil */}
                <div className="config-avatar-section">
                  <label className="config-label">
                    Foto de Perfil
                  </label>
                  
                  {/* Upload de Foto Personalizada */}
                  <div className="avatar-upload-section">
                    <label htmlFor="avatar-upload" className="avatar-upload-label">
                      <i className="fas fa-upload"></i>
                      Enviar Foto Personalizada
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar || loading}
                      className="avatar-upload-input"
                      id="avatar-upload"
                    />
                      <span className="avatar-upload-hint">
                       Formatos aceitos: JPEG, JPG, PNG, GIF, WEBP (máx. 15MB)
                      </span>
                    {uploadingAvatar && (
                      <div className="avatar-upload-loading">
                        <i className="fas fa-spinner fa-spin"></i>
                        Enviando...
                      </div>
                    )}
                    {(avatarPreview || (isCustomAvatar(formData.foto_perfil) && customAvatarPath)) && (
                      <div className="avatar-upload-preview">
                        <img
                          src={avatarPreview || customAvatarPath}
                          alt="Preview"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <span className="avatar-upload-preview-label">Sua foto</span>
                      </div>
                    )}
                  </div>

                  {/* Dica sobre duplo clique */}
                  <div className="avatar-preview-hint">
                    <i className="fas fa-info-circle"></i>
                    <span>Dica: Dê duplo clique em qualquer avatar para visualizá-lo em tamanho maior</span>
                  </div>
                  
                  {getAllAvatarOptions().map((group, groupIndex) => (
                    <div key={groupIndex} className="avatar-group">
                      <h4 className="avatar-group-title">{group.label}</h4>
                      <div className="avatar-options-grid">
                        {group.options.map((option) => {
                          const isSelected = formData.foto_perfil === option.id;
                          const isColor = option.type === 'color';
                          
                          return (
                            <div
                              key={option.id}
                              className={`avatar-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => !loading && handleInputChange('foto_perfil', option.id)}
                              onDoubleClick={() => handleAvatarDoubleClick(option)}
                            >
                                  {isColor ? (
                                <div
                                  className="avatar-preview avatar-preview-color"
                                  style={{ background: option.gradient }}
                                >
                                  {getInitialsFromName(formData.nome_usuario)}
                                </div>
                              ) : (
                                <div className="avatar-preview avatar-preview-image">
                                  <img
                                    src={option.path}
                                    alt={option.name}
                                    loading="lazy"
                                    decoding="async"
                                    fetchpriority="low"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.parentElement.innerHTML = '<div class="avatar-fallback">?</div>';
                                    }}
                                  />
                                </div>
                              )}
                              <div className="avatar-tooltip">{option.name}</div>
                              {isSelected && (
                                <div className="avatar-selected-indicator">
                                  <i className="fas fa-check-circle"></i>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="config-form-grid">
                  <div className="config-form-group">
                    <label className="config-label">
                      Senha Atual <span className="required">*</span>
                    </label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPasswords.senha_atual ? 'text' : 'password'}
                        className={`config-input ${errors.senha_atual ? 'error' : ''}`}
                        value={formData.senha_atual}
                        onChange={(e) => handleInputChange('senha_atual', e.target.value)}
                        placeholder="Digite sua senha atual"
                        disabled={loading}
                      />
                      <i
                        className={`fas ${showPasswords.senha_atual ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                        onClick={() => togglePasswordVisibility('senha_atual')}
                        title={showPasswords.senha_atual ? 'Ocultar senha' : 'Mostrar senha'}
                      ></i>
                    </div>
                    {errors.senha_atual && (
                      <span className="config-error">{errors.senha_atual}</span>
                    )}
                    <span className="config-hint">
                      Obrigatória apenas se desejar alterar a senha.
                    </span>
                  </div>

                  <div className="config-form-group">
                    <label className="config-label">Nova Senha</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPasswords.senha_nova ? 'text' : 'password'}
                        className={`config-input ${errors.senha_nova ? 'error' : ''}`}
                        value={formData.senha_nova}
                        onChange={(e) => handleInputChange('senha_nova', e.target.value)}
                        placeholder="Digite a nova senha"
                        disabled={loading || !formData.senha_atual}
                      />
                      <i
                        className={`fas ${showPasswords.senha_nova ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                        onClick={() => togglePasswordVisibility('senha_nova')}
                        title={showPasswords.senha_nova ? 'Ocultar senha' : 'Mostrar senha'}
                      ></i>
                    </div>
                    {errors.senha_nova && (
                      <span className="config-error">{errors.senha_nova}</span>
                    )}
                    <span className="config-hint">
                      Mínimo de 6 caracteres. Deixe em branco para manter a senha atual.
                    </span>
                  </div>

                  <div className="config-form-group">
                    <label className="config-label">Confirmar Nova Senha</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPasswords.senha_confirmacao ? 'text' : 'password'}
                        className={`config-input ${errors.senha_confirmacao ? 'error' : ''}`}
                        value={formData.senha_confirmacao}
                        onChange={(e) => handleInputChange('senha_confirmacao', e.target.value)}
                        placeholder="Confirme a nova senha"
                        disabled={loading || !formData.senha_nova}
                      />
                      <i
                        className={`fas ${showPasswords.senha_confirmacao ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                        onClick={() => togglePasswordVisibility('senha_confirmacao')}
                        title={showPasswords.senha_confirmacao ? 'Ocultar senha' : 'Mostrar senha'}
                      ></i>
                    </div>
                    {errors.senha_confirmacao && (
                      <span className="config-error">{errors.senha_confirmacao}</span>
                    )}
                  </div>
                </div>

                <div className="config-actions">
                  <button 
                    type="submit" 
                    className="config-btn config-btn-primary" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        Salvar Alterações
                      </>
                    )}
                  </button>
                  <button 
                    type="button"
                    className="config-btn config-btn-secondary"
                    onClick={() => window.location.reload()}
                    disabled={loading}
                  >
                    <i className="fas fa-undo"></i>
                    Cancelar
                  </button>
                </div>
              </form>
            </CardContainer>
          </div>
        </main>
      </div>

      {/* Modal de Crop de Imagem */}
      {showCropModal && imageToCrop && (
        <ImageCropModal
          imageSrc={imageToCrop}
          onClose={() => {
            setShowCropModal(false);
            setImageToCrop(null);
          }}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Modal de Preview do Avatar */}
      {previewAvatar && (
        <div className="avatar-preview-modal-overlay" onClick={closePreviewModal}>
          <div className="avatar-preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="avatar-preview-modal-header">
              <h3>{previewAvatar.name}</h3>
              <button
                className="avatar-preview-modal-close"
                onClick={closePreviewModal}
                aria-label="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="avatar-preview-modal-body">
              {previewAvatar.type === 'color' ? (
                <div
                  className="avatar-preview-large avatar-preview-large-color"
                  style={{ background: previewAvatar.gradient }}
                >
                  {getInitialsFromName(formData.nome_usuario)}
                </div>
              ) : (
                <div className="avatar-preview-large avatar-preview-large-image">
                  <img
                    src={previewAvatar.path}
                    alt={previewAvatar.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<div class="avatar-fallback-large">?</div>';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ConfiguracoesPerfil;
