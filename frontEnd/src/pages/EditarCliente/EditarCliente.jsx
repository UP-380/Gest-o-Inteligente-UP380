import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ClienteForm from '../../components/clients/ClienteForm';
import ClienteContasBancariasList from '../../components/clientes-conta-bancaria/ClienteContasBancariasList';
import ClienteSistemasList from '../../components/clientes-sistema/ClienteSistemasList';
import ClienteAdquirentesList from '../../components/clientes-adquirente/ClienteAdquirentesList';
import VinculacoesContent from '../../components/clients/DetailContent/VinculacoesContent';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import ImageCropModal from '../../components/user/ImageCropModal';
import Avatar from '../../components/user/Avatar';
import { clientesAPI } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { AVATAR_COLORS, DEFAULT_AVATAR, isColorAvatar, isCustomAvatar, getAvatarColor, getInitialsFromName } from '../../utils/avatars';
import './EditarCliente.css';

const API_BASE_URL = '/api';

const EditarCliente = () => {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    razao: '',
    fantasia: '',
    amigavel: '',
    cnpj: '',
    status: '',
    kaminoNome: '',
    kaminoId: '',
    clickupNome: '',
    foto_perfil: null,
    uploadedFotoPath: null
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para foto de perfil
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  // Estados dos modais
  const [showModalContas, setShowModalContas] = useState(false);
  const [showModalSistemas, setShowModalSistemas] = useState(false);
  const [showModalAdquirentes, setShowModalAdquirentes] = useState(false);
  
  // Estado para vinculações
  const [vinculacoes, setVinculacoes] = useState([]);
  const [loadingVinculacoes, setLoadingVinculacoes] = useState(false);

  // Refs para dados externos
  const allClientesKaminoRef = useRef([]);
  const clientesKaminoMapRef = useRef(new Map());

  // Carregar clientes Kamino (apenas se ainda não foram carregados)
  const loadClientesKamino = useCallback(async () => {
    // Se já tem dados carregados, não precisa fazer nova requisição
    if (allClientesKaminoRef.current && allClientesKaminoRef.current.length > 0) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/clientes-kamino`, {
        credentials: 'include',
      });
      const result = await response.json();
      if (result && result.success && Array.isArray(result.clientes)) {
        allClientesKaminoRef.current = result.clientes;
        clientesKaminoMapRef.current.clear();
        result.clientes.forEach(cliente => {
          if (cliente && cliente.nome_fantasia && cliente.id) {
            clientesKaminoMapRef.current.set(cliente.nome_fantasia, cliente.id);
          }
        });
      }
    } catch (error) {
      console.error('Erro ao carregar clientes Kamino:', error);
    }
  }, []);


  // Carregar dados do cliente
  const loadCliente = useCallback(async () => {
    if (!clienteId) {
      // Se não tem clienteId na URL, pode vir do state da navegação
      const stateCliente = location.state?.cliente;
      if (stateCliente) {
        setCliente(stateCliente);
        return;
      }
      showToast('error', 'ID do cliente não fornecido');
      navigate('/cadastro/clientes');
      return;
    }

    setLoading(true);
    try {
      // Não carregar clientes Kamino aqui - será carregado quando o campo receber foco

      // Carregar dados do cliente
      const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        // O endpoint retorna { success: true, data: { cliente: {...} } }
        const clienteData = result.data.cliente || result.data;
        setCliente(clienteData);

        // Preparar dados do formulário
        // O backend retorna campos do banco: razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, nome
        // O formulário usa: razao, fantasia, amigavel, cnpj, clickupNome
        const cnpjRaw = clienteData.cpf_cnpj || clienteData.cnpj || '';
        const cnpjLimpo = cnpjRaw ? cnpjRaw.replace(/\D/g, '') : '';

        // Garantir que foto_perfil tenha um valor válido
        const fotoPerfilValue = clienteData.foto_perfil || DEFAULT_AVATAR;

        // Mapear campos do backend para o formulário
        setFormData(prev => ({
          ...prev,
          id: clienteData.id,
          // Mapear razao_social -> razao
          razao: clienteData.razao_social || clienteData.razao || '',
          // Mapear nome_fantasia -> fantasia
          fantasia: clienteData.nome_fantasia || clienteData.fantasia || '',
          // Mapear nome_amigavel -> amigavel
          amigavel: clienteData.nome_amigavel || clienteData.amigavel || '',
          // Mapear cpf_cnpj -> cnpj (já limpo)
          cnpj: cnpjLimpo,
          status: clienteData.status || '',
          // Mapear nome_cli_kamino -> kaminoNome
          kaminoNome: clienteData.nome_cli_kamino || clienteData.kaminoNome || '',
          // Mapear id_cli_kamino -> kaminoId
          kaminoId: clienteData.id_cli_kamino || clienteData.kaminoId || '',
          // Mapear nome -> clickupNome
          clickupNome: clienteData.nome || clienteData.clickupNome || clienteData.clickup_nome || '',
          foto_perfil: fotoPerfilValue,
          uploadedFotoPath: null
        }));

        // Limpar foto preview quando carregar dados do backend
        setFotoPreview(null);
      } else {
        throw new Error(result.error || 'Erro ao carregar dados do cliente');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados do cliente:', error);
      showToast('error', 'Erro ao carregar dados do cliente. Tente novamente.');
      navigate('/cadastro/clientes');
    } finally {
      setLoading(false);
    }
  }, [clienteId, location.state, loadClientesKamino, showToast, navigate]);

  useEffect(() => {
    loadCliente();
  }, [loadCliente]);

  // Carregar vinculações quando o cliente tiver ID
  useEffect(() => {
    if (formData.id) {
      loadVinculacoes(formData.id);
    } else {
      setVinculacoes([]);
    }
  }, [formData.id, loadVinculacoes]);

  // Função para upload de foto
  const handleFotoUpload = (e) => {
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

  // Função para quando o crop estiver completo
  const handleCropComplete = async (croppedFile) => {
    setShowCropModal(false);
    setUploadingFoto(true);

    try {
      const result = await clientesAPI.uploadClienteFoto(croppedFile, formData.id || clienteId);
      
      if (result.success) {
        // foto_perfil já contém a URL completa do Supabase Storage
        setFotoPreview(URL.createObjectURL(croppedFile));
        
        const fotoPerfilUrl = result.cliente.foto_perfil || result.imagePath || DEFAULT_AVATAR;
        
        setFormData(prev => ({
          ...prev,
          foto_perfil: fotoPerfilUrl
        }));
        
        setCliente(prev => ({
          ...prev,
          foto_perfil: fotoPerfilUrl
        }));
        
        showToast('success', 'Foto carregada! Clique em "Salvar" para confirmar.');
      } else {
        throw new Error(result.error || 'Erro ao fazer upload');
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showToast('error', error.message || 'Erro ao fazer upload da imagem. Tente novamente.');
      setFotoPreview(null);
    } finally {
      setUploadingFoto(false);
      setImageToCrop(null);
    }
  };

  // Salvar edição de cliente
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!formData.id) return;

    setSubmitting(true);
    setFormErrors({});

    try {
      const sanitize = (val) => (val && String(val).trim() !== '' ? String(val).trim() : null);

      // Garantir que foto_perfil tenha um valor válido (usar DEFAULT_AVATAR se não houver)
      // IMPORTANTE: Não usar DEFAULT_AVATAR se formData.foto_perfil for null/undefined/empty
      // Se o usuário selecionou um avatar, ele deve ser salvo
      const fotoPerfilValue = (formData.foto_perfil && String(formData.foto_perfil).trim() !== '') 
        ? String(formData.foto_perfil).trim() 
        : (cliente?.foto_perfil && String(cliente.foto_perfil).trim() !== '' ? String(cliente.foto_perfil).trim() : DEFAULT_AVATAR);
      
      console.log('💾 Salvando avatar:', {
        formDataFotoPerfil: formData.foto_perfil,
        clienteFotoPerfil: cliente?.foto_perfil,
        fotoPerfilValueFinal: fotoPerfilValue
      });

      const payloadById = {
        razao_social: sanitize(formData.razao),
        nome_fantasia: sanitize(formData.fantasia),
        nome_amigavel: sanitize(formData.amigavel),
        cpf_cnpj: sanitize(formData.cnpj),
        status: sanitize(formData.status),
        nome_cli_kamino: sanitize(formData.kaminoNome),
        id_cli_kamino: sanitize(formData.kaminoId),
        foto_perfil: fotoPerfilValue,
      };

      const endpoint = `${API_BASE_URL}/clientes/${formData.id}`;
      
      const resp = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadById),
        credentials: 'include',
      });

      if (resp.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error || data?.message || 'Erro ao salvar cliente');
      }

      const result = await resp.json();
      if (result.success) {
        showToast('success', 'Cliente atualizado com sucesso!');
        
        // Recarregar dados do cliente (avatar é resolvido automaticamente via Supabase Storage)
        // Isso atualiza o estado do cliente e formData com os dados mais recentes
        await loadCliente();
      } else {
        throw new Error(result.error || 'Erro ao salvar cliente');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao salvar cliente. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, showToast, navigate, clienteId, loadCliente]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState />
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  if (!cliente) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <i className="fas fa-exclamation-circle" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}></i>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Cliente não encontrado</h3>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>Não foi possível carregar os dados do cliente.</p>
                <button
                  className="btn-secondary"
                  onClick={() => navigate(-1)}
                >
                  Voltar
                </button>
              </div>
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="editar-cliente-container">
              {/* Header */}
              <div className="knowledge-page-header">
                <div className="knowledge-header-content">
                  <div className="knowledge-header-left">
                    <div className="knowledge-header-icon">
                      <Avatar
                        avatarId={cliente?.foto_perfil || DEFAULT_AVATAR}
                        nomeUsuario={cliente?.nome_fantasia || cliente?.fantasia || cliente?.razao_social || cliente?.razao || cliente?.nome_amigavel || cliente?.amigavel || cliente?.nome || 'Cliente'}
                        size="large"
                      />
                    </div>
                    <div>
                      <h2 className="knowledge-page-title">
                        {cliente.fantasia || cliente.nome_fantasia || cliente.razao || cliente.razao_social || cliente.nome_amigavel || cliente.nome || 'Cliente'}
                      </h2>
                      <p className="knowledge-page-subtitle">
                        Edite as informações do cliente
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary knowledge-back-btn"
                      onClick={() => navigate(-1)}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="editar-cliente-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <form id="editar-cliente-form" onSubmit={handleSubmit}>
                {/* Seção de Foto de Perfil */}
                <div className="editar-cliente-form-section">
                  <div className="section-header">
                    <div className="section-icon" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
                      <i className="fas fa-camera"></i>
                    </div>
                    <h2 className="section-title">Foto Perfil</h2>
                  </div>
                  <div className="section-content">
                    <div className="config-avatar-section">
                      {/* Preview da foto atual (customizada) - acima das colunas */}
                      {(fotoPreview || (formData.foto_perfil && (formData.foto_perfil.startsWith('http://') || formData.foto_perfil.startsWith('https://')))) && (
                        <div className="cliente-foto-preview" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                          <img
                            src={fotoPreview || formData.foto_perfil}
                            alt="Foto do cliente"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="cliente-foto-fallback" style={{ display: 'none' }}>
                            <i className="fas fa-user"></i>
                          </div>
                          <span className="cliente-foto-preview-label">Foto do cliente</span>
                        </div>
                      )}

                      {/* Layout de duas colunas */}
                      <div className="avatar-layout-columns">
                        {/* Coluna 1: Upload de Foto Personalizada */}
                        <div className="avatar-column avatar-column-upload">
                          <div className="avatar-upload-section">
                            <label htmlFor="cliente-foto-upload" className="avatar-upload-label">
                              <i className="fas fa-upload"></i>
                              Enviar Foto Personalizada
                            </label>
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                              onChange={handleFotoUpload}
                              disabled={uploadingFoto || submitting}
                              className="avatar-upload-input"
                              id="cliente-foto-upload"
                            />
                            <span className="avatar-upload-hint">
                              Formatos aceitos: JPEG, JPG, PNG, GIF, WEBP (máx. 15MB)
                            </span>
                            {uploadingFoto && (
                              <div className="avatar-upload-loading">
                                <i className="fas fa-spinner fa-spin"></i>
                                Enviando...
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Coluna 2: Avatares com Iniciais */}
                        <div className="avatar-column avatar-column-avatars">
                          <div className="avatar-group">
                            <div className="avatar-options-grid">
                              {AVATAR_COLORS.map((colorOption) => {
                                const isSelected = formData.foto_perfil === colorOption.id;
                                const clienteNome = formData.amigavel || formData.fantasia || formData.razao || 'Cliente';
                                
                                return (
                                  <div
                                    key={colorOption.id}
                                    className={`avatar-option ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                  if (!submitting) {
                                    const newFotoPerfil = colorOption.id || DEFAULT_AVATAR;
                                    setFormData(prev => ({
                                      ...prev,
                                      foto_perfil: newFotoPerfil,
                                      uploadedFotoPath: null
                                    }));
                                    setFotoPreview(null);
                                  }
                                }}
                                  >
                                    <div
                                      className="avatar-preview avatar-preview-color"
                                      style={{ background: colorOption.gradient }}
                                    >
                                      {getInitialsFromName(clienteNome)}
                                    </div>
                                    <div className="avatar-tooltip">{colorOption.name}</div>
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
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="editar-cliente-form-section">
                  <div className="section-header">
                    <div className="section-icon" style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}>
                      <i className="fas fa-briefcase"></i>
                    </div>
                    <h2 className="section-title">Dados Básicos</h2>
                  </div>
                  <div className="section-content">
                    <ClienteForm
                      formData={formData}
                      setFormData={setFormData}
                      formErrors={formErrors}
                      setFormErrors={setFormErrors}
                      submitting={submitting}
                      allClientesKamino={allClientesKaminoRef.current}
                      clientesKaminoMap={clientesKaminoMapRef.current}
                      onLoadKamino={loadClientesKamino}
                    />
                  </div>
                </div>

                {/* Seção de Fluxo da Operação */}
                {formData.id && (
                  <div className="editar-cliente-form-section">
                    <div className="section-header">
                      <div className="section-icon" style={{ backgroundColor: '#6366f115', color: '#6366f1' }}>
                        <i className="fas fa-project-diagram"></i>
                      </div>
                      <h2 className="section-title">Fluxo da Operação</h2>
                      <span className="section-badge">{vinculacoes.length}</span>
                    </div>
                    <div className="section-content">
                      {loadingVinculacoes ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <i className="fas fa-spinner fa-spin" style={{ fontSize: '20px', color: '#6b7280' }}></i>
                        </div>
                      ) : (
                        <VinculacoesContent 
                          vinculacoes={vinculacoes}
                          clienteId={formData.id}
                          onObservacaoUpdated={() => {
                            if (formData.id) {
                              loadVinculacoes(formData.id);
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="editar-cliente-actions">
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Botões de relacionamento */}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowModalContas(true)}
                      disabled={submitting || !formData.id}
                      style={{
                        padding: '10px 20px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      title="Gerenciar Contas Bancárias"
                    >
                      <i className="fas fa-university"></i>
                      Contas Bancárias
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowModalSistemas(true)}
                      disabled={submitting || !formData.id}
                      style={{
                        padding: '10px 20px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      title="Gerenciar Sistemas"
                    >
                      <i className="fas fa-server"></i>
                      Sistemas
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowModalAdquirentes(true)}
                      disabled={submitting || !formData.id}
                      style={{
                        padding: '10px 20px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      title="Gerenciar Adquirentes"
                    >
                      <i className="fas fa-credit-card"></i>
                      Adquirentes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de Contas Bancárias */}
      {showModalContas && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalContas(false);
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-university" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Contas Bancárias - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowModalContas(false)}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteContasBancariasList 
                clienteId={formData.id || clienteId} 
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sistemas */}
      {showModalSistemas && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalSistemas(false);
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-server" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Sistemas - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowModalSistemas(false)}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteSistemasList 
                clienteId={formData.id || clienteId} 
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adquirentes */}
      {showModalAdquirentes && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalAdquirentes(false);
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-credit-card" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Adquirentes - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowModalAdquirentes(false)}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteAdquirentesList 
                clienteId={formData.id || clienteId} 
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
              />
            </div>
          </div>
        </div>
      )}

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
    </Layout>
  );
};

export default EditarCliente;

