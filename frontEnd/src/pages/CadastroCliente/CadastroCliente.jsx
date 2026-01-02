import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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
import ClienteAvatarCard from '../../components/clients/ClienteAvatarCard';
import Avatar from '../../components/user/Avatar';
import { clientesAPI } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_AVATAR, isCustomAvatar } from '../../utils/avatars';
import './CadastroCliente.css';

const API_BASE_URL = '/api';

const CadastroCliente = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  // Obter clienteId da query string ou do location.state
  const clienteId = searchParams.get('id') || location.state?.clienteId || null;

  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    razao: '',
    fantasia: '',
    amigavel: '',
    nome: '',
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
  const [showAvatarCard, setShowAvatarCard] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const headerIconRef = useRef(null);

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


  // Carregar vinculações do cliente
  const loadVinculacoes = useCallback(async (id) => {
    if (!id) {
      setVinculacoes([]);
      return;
    }

    setLoadingVinculacoes(true);
    try {
      const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${id}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setVinculacoes(result.data.vinculacoes || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vinculações:', error);
      setVinculacoes([]);
    } finally {
      setLoadingVinculacoes(false);
    }
  }, []);

  // Carregar dados do cliente
  const loadCliente = useCallback(async () => {
    if (!clienteId) {
      // Se não tem clienteId, pode ser um novo cadastro ou erro
      const stateCliente = location.state?.cliente;
      if (stateCliente) {
        setCliente(stateCliente);
        return;
      }
      // Se não tem ID, mostrar formulário vazio para novo cadastro
      setLoading(false);
      setCliente(null);
      // Não carregar clientes Kamino aqui - será carregado quando o campo receber foco
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
          // Mapear nome -> nome (campo da tabela cp_clientes)
          nome: clienteData.nome || '',
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
        
        // Atualizar formData com foto_perfil
        setFormData(prev => ({
          ...prev,
          foto_perfil: clienteData.foto_perfil || DEFAULT_AVATAR
        }));
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

  // Função para upload de foto (chamada pelo card)
  const handleFotoUpload = (file) => {
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
      setShowAvatarCard(false); // Fechar card de avatar ao abrir crop
    };
    reader.readAsDataURL(file);
  };

  // Função para selecionar avatar colorido (não salva ainda, só atualiza estado)
  const handleSelectAvatar = (avatarId) => {
    if (submitting || savingAvatar) return;
    
    setFormData(prev => ({
      ...prev,
      foto_perfil: avatarId || DEFAULT_AVATAR,
      uploadedFotoPath: null
    }));
    setFotoPreview(null);
  };

  // Função para salvar apenas o avatar
  const handleSaveAvatar = async () => {
    if (!formData.id && !clienteId) {
      showToast('error', 'Cliente precisa ser salvo primeiro antes de alterar o avatar');
      return;
    }

    setSavingAvatar(true);

    try {
      const fotoPerfilValue = formData.foto_perfil || DEFAULT_AVATAR;
      
      // Se houver foto customizada (upload), já foi feito o upload no handleCropComplete
      // Agora só precisamos atualizar o foto_perfil no backend
      const payload = {
        foto_perfil: fotoPerfilValue
      };

      const idToUse = formData.id || clienteId;
      const response = await fetch(`${API_BASE_URL}/clientes/${idToUse}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar avatar');
      }

      const result = await response.json();

      if (result.success) {
        // Fazer GET para buscar dados atualizados do cliente (foto_perfil já contém URL completa)
        const idToUse = formData.id || clienteId;
        try {
          const getResponse = await fetch(`${API_BASE_URL}/clientes/${idToUse}`, {
            method: 'GET',
            credentials: 'include',
          });

          if (getResponse.ok) {
            const getResult = await getResponse.json();
            if (getResult.success && getResult.data?.cliente) {
              const clienteAtualizado = getResult.data.cliente;
              
              // Atualizar estado do cliente com dados completos
              setCliente(prev => ({
                ...prev,
                ...clienteAtualizado,
                foto_perfil: clienteAtualizado.foto_perfil || fotoPerfilValue
              }));
              
              // Atualizar formData também
              setFormData(prev => ({
                ...prev,
                foto_perfil: clienteAtualizado.foto_perfil || fotoPerfilValue
              }));
            }
          }
        } catch (getError) {
          console.error('Erro ao buscar dados atualizados do cliente:', getError);
          // Não falhar o salvamento se o GET falhar, apenas logar o erro
        }
        
        // Atualizar também o estado baseado no resultado do PUT (fallback)
        if (result.cliente) {
          setCliente(prev => ({
            ...prev,
            foto_perfil: result.cliente.foto_perfil || fotoPerfilValue
          }));
          
          setFormData(prev => ({
            ...prev,
            foto_perfil: result.cliente.foto_perfil || fotoPerfilValue
          }));
        }
        
        // Limpar preview temporário
        setFotoPreview(null);
        
        showToast('success', 'Avatar atualizado com sucesso!');
        setShowAvatarCard(false);
      } else {
        throw new Error(result.error || 'Erro ao salvar avatar');
      }
    } catch (error) {
      console.error('Erro ao salvar avatar:', error);
      showToast('error', error.message || 'Erro ao salvar avatar. Tente novamente.');
    } finally {
      setSavingAvatar(false);
    }
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
        
        // Atualizar formData e cliente com a URL completa
        const fotoPerfilUrl = result.cliente.foto_perfil || result.imagePath || DEFAULT_AVATAR;
        
        setFormData(prev => ({
          ...prev,
          foto_perfil: fotoPerfilUrl
        }));
        
        setCliente(prev => ({
          ...prev,
          foto_perfil: fotoPerfilUrl
        }));
        
        // Reabrir o card após upload para permitir salvar
        setShowAvatarCard(true);
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

      const payloadById = {
        razao_social: sanitize(formData.razao),
        nome_fantasia: sanitize(formData.fantasia),
        nome_amigavel: sanitize(formData.amigavel),
        nome: sanitize(formData.nome),
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
        // Atualizar estado do cliente com os dados retornados (sem recarregar tudo)
        if (result.cliente) {
          setCliente(prev => ({
            ...prev,
            ...result.cliente,
            foto_perfil: result.cliente.foto_perfil || prev?.foto_perfil
          }));
          
          // Atualizar formData também para manter sincronizado
          setFormData(prev => ({
            ...prev,
            razao: result.cliente.razao_social || prev.razao,
            fantasia: result.cliente.nome_fantasia || prev.fantasia,
            amigavel: result.cliente.nome_amigavel || prev.amigavel,
            cnpj: result.cliente.cpf_cnpj || prev.cnpj,
            status: result.cliente.status || prev.status,
            kaminoNome: result.cliente.nome_cli_kamino || prev.kaminoNome,
            kaminoId: result.cliente.id_cli_kamino || prev.kaminoId,
            clickupNome: result.cliente.clickup_nome || prev.clickupNome,
            foto_perfil: result.cliente.foto_perfil || prev.foto_perfil
          }));
        }
        
        showToast('success', 'Cliente atualizado com sucesso!');
      } else {
        throw new Error(result.error || 'Erro ao salvar cliente');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao salvar cliente. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, showToast, navigate, clienteId, cliente]);

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

  if (!cliente && clienteId) {
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

  // Se não tem cliente e não tem ID, pode ser novo cadastro
  if (!cliente && !clienteId) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: '#64748b' }}>Funcionalidade de novo cadastro em desenvolvimento.</p>
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
              <div className="cadastro-cliente-header">
                <div className="cadastro-cliente-header-content">
                  <div className="cadastro-cliente-header-left">
                    <div 
                      ref={headerIconRef}
                      className="cadastro-cliente-header-icon-container"
                      style={{ position: 'relative' }}
                    >
                      <div 
                        className="cadastro-cliente-header-icon"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setShowAvatarCard(!showAvatarCard)}
                        title="Clique para alterar a foto de perfil"
                      >
                        <Avatar
                          avatarId={formData.foto_perfil || cliente?.foto_perfil || DEFAULT_AVATAR}
                          nomeUsuario={formData.amigavel || cliente?.nome_amigavel || cliente?.nome_fantasia || cliente?.fantasia || cliente?.razao_social || cliente?.razao || cliente?.nome || 'Cliente'}
                          size="large"
                        />
                      </div>
                      
                      {/* Card de Avatar */}
                      {showAvatarCard && (
                        <ClienteAvatarCard
                          isOpen={showAvatarCard}
                          onClose={() => setShowAvatarCard(false)}
                          clienteNome={formData.amigavel || formData.fantasia || formData.razao || cliente?.nome_fantasia || cliente?.fantasia || 'Cliente'}
                          selectedAvatarId={formData.foto_perfil}
                          onSelectAvatar={handleSelectAvatar}
                          onUploadPhoto={handleFotoUpload}
                          onSave={handleSaveAvatar}
                          uploading={uploadingFoto}
                          saving={savingAvatar}
                        />
                      )}
                    </div>
                    <div>
                      <h2 className="cadastro-cliente-title">
                        {cliente.nome_amigavel || formData.amigavel || cliente.fantasia || cliente.nome_fantasia || cliente.razao || cliente.razao_social || cliente.nome || 'Cliente'}
                      </h2>
                      <p className="cadastro-cliente-subtitle">
                        Edite as informações do cliente
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-cliente-back-btn"
                      onClick={() => navigate(-1)}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="cliente-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <form id="cliente-form" onSubmit={handleSubmit}>
                {/* Seção de Dados Básicos */}
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
                        <VinculacoesContent vinculacoes={vinculacoes} />
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

export default CadastroCliente;

