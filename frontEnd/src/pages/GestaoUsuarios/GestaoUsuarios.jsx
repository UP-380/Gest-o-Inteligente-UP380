import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import PageHeader from '../../components/common/PageHeader';
import EditButton from '../../components/common/EditButton';
import { useToast } from '../../hooks/useToast';
import './GestaoUsuarios.css';

const API_BASE_URL = '/api';

const GestaoUsuarios = () => {
  const showToast = useToast();
  
  // Estados principais
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsuarios, setTotalUsuarios] = useState(0);

  // Estados para modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [permissaoSelecionada, setPermissaoSelecionada] = useState('administrador');
  const [salvando, setSalvando] = useState(false);

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

  // Abrir modal de edição
  const handleEdit = (usuario) => {
    const permissoes = usuario.permissoes || null;
    let nivel = 'administrador';
    
    if (permissoes) {
      // Garantir que é string antes de chamar toLowerCase
      const permissoesStr = String(permissoes).toLowerCase().trim();
      if (permissoesStr === 'gestor' || permissoesStr === 'colaborador') {
        nivel = permissoesStr;
      }
    }
    
    setUsuarioEditando(usuario);
    setPermissaoSelecionada(nivel);
    setShowEditModal(true);
  };

  // Salvar permissões
  const handleSave = async () => {
    if (!usuarioEditando) return;

    setSalvando(true);
    try {
      const permissoesValue = permissaoSelecionada === 'administrador' ? null : permissaoSelecionada;

      const response = await fetch(`${API_BASE_URL}/usuarios/${usuarioEditando.id}/permissoes`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ permissoes: permissoesValue }),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Permissões atualizadas com sucesso!');
        setShowEditModal(false);
        setUsuarioEditando(null);
        await loadUsuarios();
      } else {
        throw new Error(result.error || 'Erro ao atualizar permissões');
      }
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      showToast('error', error.message || 'Erro ao salvar permissões. Tente novamente.');
    } finally {
      setSalvando(false);
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

  // Efeitos
  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  // Função para obter label da permissão
  const getPermissaoLabel = (permissoes) => {
    // Tratar casos onde permissoes pode ser null, undefined, ou não string
    if (!permissoes || permissoes === 'null' || permissoes === '' || permissoes === null) {
      return 'Administrador';
    }
    
    // Garantir que é string antes de chamar toLowerCase
    const permissoesStr = String(permissoes).toLowerCase().trim();
    
    if (permissoesStr === 'gestor') return 'Gestor';
    if (permissoesStr === 'colaborador') return 'Colaborador';
    return 'Administrador';
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
    <EditButton
      onClick={() => handleEdit(usuario)}
      title="Editar Permissões"
    />
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="usuarios-listing-section">
              <PageHeader
                title="Gestão de Usuários"
                subtitle="Gerencie as permissões de acesso dos usuários do sistema"
              />

              {/* Filtro de busca */}
              <div className="listing-controls">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Buscar por nome ou email..."
                />
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
                            onPageChange={setCurrentPage}
                          />
                        )}

                        {/* Info de paginação */}
                        <div className="pagination-info">
                          Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalUsuarios)} de {totalUsuarios} usuários
                        </div>
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
          <div className="modal-overlay" onClick={() => !salvando && setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Editar Permissões</h3>
                <button
                  className="modal-close"
                  onClick={() => !salvando && setShowEditModal(false)}
                  disabled={salvando}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Usuário</label>
                  <input
                    type="text"
                    value={usuarioEditando?.nome_usuario || ''}
                    disabled
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="text"
                    value={usuarioEditando?.email_usuario || ''}
                    disabled
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Nível de Permissão</label>
                  <select
                    value={permissaoSelecionada}
                    onChange={(e) => setPermissaoSelecionada(e.target.value)}
                    className="form-select"
                    disabled={salvando}
                  >
                    <option value="administrador">Administrador (Acesso Total)</option>
                    <option value="gestor">Gestor (Acesso a Todas as Páginas)</option>
                    <option value="colaborador">Colaborador (Apenas Painel e Base de Conhecimento)</option>
                  </select>
                  <small className="form-help">
                    {permissaoSelecionada === 'administrador' && 'Acesso total a todas as funcionalidades do sistema'}
                    {permissaoSelecionada === 'gestor' && 'Acesso a todas as páginas do sistema'}
                    {permissaoSelecionada === 'colaborador' && 'Acesso apenas a Minhas Tarefas e Base de Conhecimento'}
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={salvando}
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
    </Layout>
  );
};

export default GestaoUsuarios;

