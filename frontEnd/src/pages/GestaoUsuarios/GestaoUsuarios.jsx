import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import PageHeader from '../../components/common/PageHeader';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import './GestaoUsuarios.css';

const API_BASE_URL = '/api';

const GestaoUsuarios = () => {
  const showToast = useToast();
  const navigate = useNavigate();

  // Estados principais
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsuarios, setTotalUsuarios] = useState(0);

  // Estados para modal de criar/editar
  const [showEditModal, setShowEditModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formData, setFormData] = useState({
    nome_usuario: '',
    email_usuario: '',
    senha_login: '',
    permissoes: 'administrador',
    membro_id: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [membros, setMembros] = useState([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [niveisPermissao, setNiveisPermissao] = useState(['administrador', 'gestor', 'colaborador']);

  // Estado para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [usuarioParaDeletar, setUsuarioParaDeletar] = useState(null);
  const [deletando, setDeletando] = useState(false);

  // Carregar usuários
  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/usuarios?${params}`, {
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

      const result = await response.json();

      if (result.success) {
        setUsuarios(result.data || []);
        setTotalUsuarios(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar usuários');
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      showToast('error', error.message || 'Erro ao carregar usuários. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  // Abrir modal para criar novo usuário
  const handleNewUsuario = () => {
    setUsuarioEditando(null);
    setFormData({
      nome_usuario: '',
      email_usuario: '',
      senha_login: '',
      permissoes: 'administrador',
      membro_id: ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  // Abrir modal de edição
  const handleEdit = async (usuario) => {
    const permissoes = usuario.permissoes || null;
    let nivel = 'administrador';

    if (permissoes) {
      // Garantir que é string antes de chamar toLowerCase
      const permissoesStr = String(permissoes).toLowerCase().trim();
      if (permissoesStr === 'administrador' || permissoesStr === 'gestor' || permissoesStr === 'colaborador') {
        nivel = permissoesStr;
      }
    }

    // Buscar membro vinculado ao usuário
    let membroId = '';
    try {
      const membroResponse = await fetch(`${API_BASE_URL}/membros-por-usuario/${usuario.id}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (membroResponse.ok) {
        const membroResult = await membroResponse.json();
        if (membroResult.success && membroResult.data && membroResult.data.length > 0) {
          membroId = membroResult.data[0].id;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar membro vinculado:', error);
    }

    setUsuarioEditando(usuario);
    setFormData({
      nome_usuario: usuario.nome_usuario || '',
      email_usuario: usuario.email_usuario || '',
      senha_login: '', // Não mostrar senha ao editar
      permissoes: nivel,
      membro_id: membroId
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  // Abrir modal de confirmação de exclusão
  const handleDelete = (usuario) => {
    setUsuarioParaDeletar(usuario);
    setShowDeleteModal(true);
  };

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.nome_usuario.trim()) {
      errors.nome_usuario = 'Nome é obrigatório';
    }

    if (!formData.email_usuario.trim()) {
      errors.email_usuario = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_usuario)) {
      errors.email_usuario = 'Email inválido';
    }

    if (!usuarioEditando && !formData.senha_login.trim()) {
      errors.senha_login = 'Senha é obrigatória';
    } else if (formData.senha_login && formData.senha_login.length < 6) {
      errors.senha_login = 'Senha deve ter no mínimo 6 caracteres';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Salvar usuário (criar ou atualizar)
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSalvando(true);
    try {
      const permissoesValue = formData.permissoes === 'administrador' ? 'administrador' : formData.permissoes;

      const body = {
        nome_usuario: formData.nome_usuario.trim(),
        email_usuario: formData.email_usuario.trim(),
        permissoes: permissoesValue
      };

      // Só incluir senha se foi preenchida
      if (formData.senha_login.trim()) {
        body.senha_login = formData.senha_login;
      }

      // Sempre incluir membro_id (pode ser vazio para desvincular)
      // Se estiver vazio, será tratado como desvinculação no backend
      body.membro_id = formData.membro_id || null;

      const url = usuarioEditando
        ? `${API_BASE_URL}/usuarios/${usuarioEditando.id}`
        : `${API_BASE_URL}/usuarios`;

      const method = usuarioEditando ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            // Tentar parsear como JSON
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorMessage;
            } catch {
              // Se não for JSON, usar o texto (limitado)
              errorMessage = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
            }
          }
        } catch (e) {
          console.error('Erro ao ler resposta:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', usuarioEditando ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
        setShowEditModal(false);
        setUsuarioEditando(null);
        await loadUsuarios();
      } else {
        throw new Error(result.error || 'Erro ao salvar usuário');
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      showToast('error', error.message || 'Erro ao salvar usuário. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // Confirmar e deletar usuário
  const handleConfirmDelete = async () => {
    if (!usuarioParaDeletar) return;

    setDeletando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/${usuarioParaDeletar.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorMessage;
            } catch {
              errorMessage = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
            }
          }
        } catch (e) {
          console.error('Erro ao ler resposta:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Usuário deletado com sucesso!');
        setShowDeleteModal(false);
        setUsuarioParaDeletar(null);
        await loadUsuarios();
      } else {
        throw new Error(result.error || 'Erro ao deletar usuário');
      }
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      showToast('error', error.message || 'Erro ao deletar usuário. Tente novamente.');
    } finally {
      setDeletando(false);
    }
  };

  // Debounce para busca
  const searchTimeoutRef = useRef(null);
  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
  }, []);

  // Carregar membros disponíveis
  useEffect(() => {
    const loadMembros = async () => {
      setLoadingMembros(true);
      try {
        const response = await fetch(`${API_BASE_URL}/colaboradores?limit=1000`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }

        const result = await response.json();

        if (result.success) {
          setMembros(result.data || []);
        }
      } catch (error) {
        console.error('Erro ao carregar membros:', error);
      } finally {
        setLoadingMembros(false);
      }
    };

    const loadNiveisPermissao = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/permissoes-config`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        const result = await response.json();
        if (result.success) {
          const niveis = result.data.map(n => n.nivel);
          // Garantir que administrador e os básicos estejam na lista se não vierem do banco
          const todosNiveis = [...new Set(['administrador', 'gestor', 'colaborador', ...niveis])];
          setNiveisPermissao(todosNiveis);
        }
      } catch (error) {
        console.error('Erro ao carregar níveis de permissão:', error);
      }
    };

    loadMembros();
    loadNiveisPermissao();
  }, []);

  // Efeitos
  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  // Fechar modal com ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && showEditModal && !salvando) {
        setShowEditModal(false);
      }
    };
    if (showEditModal) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showEditModal, salvando]);

  // Função para obter label da permissão
  const getPermissaoLabel = (permissoes) => {
    if (!permissoes || permissoes === 'null' || permissoes === '' || permissoes === null) {
      return 'Sem Permissão';
    }

    const permissoesStr = String(permissoes).toLowerCase().trim();
    return permissoesStr.charAt(0).toUpperCase() + permissoesStr.slice(1);
  };

  // Definir colunas da tabela
  const tableColumns = [
    { key: 'nome_usuario', label: 'Nome' },
    { key: 'email_usuario', label: 'Email' },
    {
      key: 'permissoes',
      label: 'Permissão',
      render: (item) => getPermissaoLabel(item.permissoes)
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (usuario) => (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <EditButton
        onClick={() => handleEdit(usuario)}
        title="Editar Usuário"
      />
      <DeleteButton
        onClick={() => handleDelete(usuario)}
        title="Deletar Usuário"
      />
    </div>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="usuarios-listing-section">
              <div className="form-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <h2 className="form-title">Gestão de Usuários</h2>
                    <p className="form-subtitle">
                      Gerencie as permissões de acesso dos usuários do sistema
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/gestao/permissoes')}
                    className="custo-colaborador-btn"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      transition: 'all 0.2s',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: 0.7
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.color = '#475569';
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.opacity = '0.7';
                    }}
                    title="Configurar Permissões"
                  >
                    <i className="fas fa-shield-alt" style={{
                      fontSize: '16px'
                    }}></i>
                    <span>Configurar Permissões</span>
                  </button>
                </div>
              </div>

              {/* Filtro de busca e botão novo */}
              <div className="listing-controls">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Buscar por nome ou email..."
                />
                <div className="listing-controls-right">
                  <button
                    className="add-client-btn active"
                    onClick={handleNewUsuario}
                    disabled={loading}
                    type="button"
                  >
                    <i className="fas fa-user-plus"></i>
                    Novo Usuário
                  </button>
                </div>
              </div>

              {/* Lista de usuários */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando usuários..." />
                ) : (
                  <>
                    <DataTable
                      data={usuarios}
                      columns={tableColumns}
                      renderActions={renderTableActions}
                      emptyMessage="Nenhum usuário encontrado"
                    />

                    {usuarios.length > 0 && (
                      <>
                        {/* Paginação */}
                        {totalPages > 1 && (
                          <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalUsuarios}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            itemName="usuários"
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de Edição */}
      {showEditModal && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{
              maxWidth: '900px',
              width: '95%',
              maxHeight: '95vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                borderBottom: '1px solid #eee',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <i className={`fas ${usuarioEditando ? 'fa-user-edit' : 'fa-user-plus'}`} style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                  {usuarioEditando ? 'Editar Usuário' : 'Novo Usuário'}
                </h3>
              </div>
              <button
                className="btn-icon"
                onClick={() => !salvando && setShowEditModal(false)}
                title="Fechar (ESC)"
                disabled={salvando}
                style={{ fontSize: '18px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                padding: '20px 24px',
                overflowY: 'auto',
                overflowX: 'hidden',
                flex: 1,
                minHeight: 0
              }}
            >
              {/* Informações do Usuário */}
              <div style={{ marginBottom: '20px', paddingBottom: '18px', borderBottom: '2px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{
                    width: '4px',
                    height: '20px',
                    backgroundColor: '#0e3b6f',
                    borderRadius: '2px',
                    marginRight: '12px'
                  }}></div>
                  <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                    <i className="fas fa-user" style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
                    Informações do Usuário
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                      Nome do Usuário
                      <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nome_usuario}
                      onChange={(e) => {
                        setFormData({ ...formData, nome_usuario: e.target.value });
                        if (formErrors.nome_usuario) {
                          setFormErrors({ ...formErrors, nome_usuario: '' });
                        }
                      }}
                      disabled={salvando}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: '14px',
                        border: formErrors.nome_usuario ? '2px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: salvando ? '#f3f4f6' : '#fff',
                        transition: 'border-color 0.2s'
                      }}
                      placeholder="Digite o nome do usuário"
                    />
                    {formErrors.nome_usuario && (
                      <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                        {formErrors.nome_usuario}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                      Email
                      <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email_usuario}
                      onChange={(e) => {
                        setFormData({ ...formData, email_usuario: e.target.value });
                        if (formErrors.email_usuario) {
                          setFormErrors({ ...formErrors, email_usuario: '' });
                        }
                      }}
                      disabled={salvando}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: '14px',
                        border: formErrors.email_usuario ? '2px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: salvando ? '#f3f4f6' : '#fff',
                        transition: 'border-color 0.2s'
                      }}
                      placeholder="Digite o email"
                    />
                    {formErrors.email_usuario && (
                      <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                        {formErrors.email_usuario}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Senha
                    {!usuarioEditando && <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
                    {usuarioEditando && <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px', fontWeight: 'normal' }}>(Deixe em branco para não alterar)</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.senha_login}
                    onChange={(e) => {
                      setFormData({ ...formData, senha_login: e.target.value });
                      if (formErrors.senha_login) {
                        setFormErrors({ ...formErrors, senha_login: '' });
                      }
                    }}
                    disabled={salvando}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.senha_login ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: salvando ? '#f3f4f6' : '#fff',
                      transition: 'border-color 0.2s'
                    }}
                    placeholder={usuarioEditando ? "Deixe em branco para não alterar" : "Digite a senha"}
                  />
                  {formErrors.senha_login && (
                    <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                      {formErrors.senha_login}
                    </span>
                  )}
                </div>
              </div>

              {/* Vincular Membro */}
              <div style={{ marginTop: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{
                    width: '4px',
                    height: '20px',
                    backgroundColor: '#0e3b6f',
                    borderRadius: '2px',
                    marginRight: '12px'
                  }}></div>
                  <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                    <i className="fas fa-user-tie" style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
                    Vincular Membro
                  </h4>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Selecione o membro (opcional)
                  </label>
                  <select
                    value={formData.membro_id || ''}
                    onChange={(e) => setFormData({ ...formData, membro_id: e.target.value })}
                    disabled={salvando || loadingMembros}
                    style={{
                      width: '100%',
                      padding: '9px 36px 9px 12px',
                      fontSize: '14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: salvando || loadingMembros ? '#f3f4f6' : '#fff',
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '12px',
                      cursor: salvando || loadingMembros ? 'not-allowed' : 'pointer',
                      position: 'relative',
                      zIndex: 10005
                    }}
                  >
                    <option value="">Nenhum membro vinculado</option>
                    {membros.map((membro) => (
                      <option key={membro.id} value={membro.id}>
                        {membro.nome}
                      </option>
                    ))}
                  </select>
                  <p style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    color: '#6b7280',
                    fontStyle: 'italic'
                  }}>
                    Vincule um membro (colaborador) a este usuário para associar as informações
                  </p>
                </div>
              </div>

              {/* Nível de Permissão */}
              <div style={{ marginTop: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{
                    width: '4px',
                    height: '20px',
                    backgroundColor: '#fd7e14',
                    borderRadius: '2px',
                    marginRight: '12px'
                  }}></div>
                  <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                    <i className="fas fa-shield-alt" style={{ marginRight: '8px', color: '#fd7e14' }}></i>
                    Nível de Permissão
                  </h4>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Selecione o nível de permissão
                    <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', zIndex: 10005 }}>
                    <select
                      value={formData.permissoes}
                      onChange={(e) => setFormData({ ...formData, permissoes: e.target.value })}
                      disabled={salvando}
                      style={{
                        width: '100%',
                        padding: '9px 36px 9px 12px',
                        fontSize: '14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        transition: 'border-color 0.2s',
                        backgroundColor: salvando ? '#f3f4f6' : '#fff',
                        appearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '12px',
                        cursor: salvando ? 'not-allowed' : 'pointer',
                        position: 'relative',
                        zIndex: 10006
                      }}
                    >
                      {niveisPermissao.map(nivel => (
                        <option key={nivel} value={nivel}>
                          {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
                          {nivel === 'administrador' ? ' (Acesso Total)' :
                            nivel === 'gestor' ? ' (Acesso Completo)' :
                              nivel === 'colaborador' ? ' (Acesso Restrito)' : ' (Customizado)'}
                        </option>
                      ))}
                    </select>
                    {formData.permissoes && (
                      <i className="fas fa-check-circle" style={{
                        position: 'absolute',
                        right: '32px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#0e3b6f',
                        fontSize: '16px',
                        pointerEvents: 'none',
                        zIndex: 10007
                      }}></i>
                    )}
                  </div>

                  {/* Descrição do nível selecionado */}
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: formData.permissoes === 'administrador' ? '#e6f0ff' :
                      formData.permissoes === 'gestor' ? '#fff4e6' : '#f1f5f9',
                    border: `1px solid ${formData.permissoes === 'administrador' ? '#0e3b6f' :
                      formData.permissoes === 'gestor' ? '#fd7e14' : '#64748b'}`,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <i className={`fas ${formData.permissoes === 'administrador' ? 'fa-crown' :
                      formData.permissoes === 'gestor' ? 'fa-user-tie' : 'fa-user'
                      }`} style={{
                        color: formData.permissoes === 'administrador' ? '#0e3b6f' :
                          formData.permissoes === 'gestor' ? '#fd7e14' : '#64748b',
                        fontSize: '16px',
                        marginTop: '2px',
                        flexShrink: 0
                      }}></i>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '13px',
                        color: '#1f2937',
                        marginBottom: '4px'
                      }}>
                        {formData.permissoes === 'administrador' && 'Acesso Total'}
                        {formData.permissoes === 'gestor' && 'Acesso Completo'}
                        {formData.permissoes === 'colaborador' && 'Acesso Restrito'}
                        {!['administrador', 'gestor', 'colaborador'].includes(formData.permissoes) && 'Acesso Customizado'}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        lineHeight: '1.5'
                      }}>
                        {formData.permissoes === 'administrador' && 'Acesso total a todas as funcionalidades do sistema, incluindo gestão de usuários e configurações.'}
                        {formData.permissoes === 'gestor' && 'Acesso a todas as páginas do sistema, exceto gestão de usuários e configurações de permissões.'}
                        {formData.permissoes === 'colaborador' && 'Acesso restrito conforme configuração definida nas permissões do sistema.'}
                        {!['administrador', 'gestor', 'colaborador'].includes(formData.permissoes) && `Acesso customizado para o nível ${formData.permissoes}. Configure as páginas permitidas em Permissões.`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #eee',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                flexShrink: 0,
                marginTop: 'auto'
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowEditModal(false)}
                disabled={salvando}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px'
                }}
              >
                <i className="fas fa-times" style={{ marginRight: '6px' }}></i>
                Cancelar
              </button>
              <button
                type="button"
                className="add-client-btn active"
                onClick={handleSave}
                disabled={salvando}
              >
                {salvando ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Salvando...
                  </>
                ) : (
                  <>
                    <i className={`fas ${usuarioEditando ? 'fa-save' : 'fa-user-plus'}`}></i>
                    {usuarioEditando ? 'Salvar' : 'Criar'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUsuarioParaDeletar(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Deletar Usuário"
        message={
          usuarioParaDeletar ? (
            <>
              <p>
                Tem certeza que deseja deletar o usuário <strong>{usuarioParaDeletar.nome_usuario}</strong> ({usuarioParaDeletar.email_usuario})?
              </p>
              <p style={{ color: '#b45309', marginTop: '8px' }}>Esta ação não pode ser desfeita.</p>
            </>
          ) : (
            ''
          )
        }
        confirmText="Deletar"
        loading={deletando}
      />
    </Layout>
  );
};

export default GestaoUsuarios;
