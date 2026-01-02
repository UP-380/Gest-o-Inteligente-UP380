import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import { useToast } from '../../hooks/useToast';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import './CadastroSistemas.css';

const API_BASE_URL = '/api';

const CadastroSistemas = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [sistemas, setSistemas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSistemas, setTotalSistemas] = useState(0);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sistemaToDelete, setSistemaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar sistemas
  const loadSistemas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/sistemas?${params}`, {
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

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        if (contentType.includes('text/html')) {
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/sistemas existe no backend. Status: ${response.status}`);
        }
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setSistemas(result.data || []);
        setTotalSistemas(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar sistemas');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar sistemas:', error);
      const errorMessage = error.message || 'Erro ao carregar sistemas. Tente novamente.';
      showToast('error', errorMessage);
      setSistemas([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);


  // Deletar sistema
  const handleDelete = useCallback(async () => {
    if (!sistemaToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/sistemas/${sistemaToDelete.id}`, {
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

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Sistema deletado com sucesso!');
        setShowDeleteModal(false);
        setSistemaToDelete(null);
        await loadSistemas();
      } else {
        throw new Error(result.error || 'Erro ao deletar sistema');
      }
    } catch (error) {
      console.error('Erro ao deletar sistema:', error);
      showToast('error', error.message || 'Erro ao deletar sistema. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [sistemaToDelete, loadSistemas, showToast]);

  // Navegar para novo sistema
  const handleNewSistema = () => {
    navigate('/cadastro/sistema', { state: { from: '/cadastro/sistemas' } });
  };

  // Navegar para edição
  const handleEdit = (sistema) => {
    navigate(`/cadastro/sistema?id=${sistema.id}`, { state: { from: '/cadastro/sistemas' } });
  };

  // Confirmar exclusão
  const confirmDelete = (sistema) => {
    setSistemaToDelete(sistema);
    setShowDeleteModal(true);
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
    loadSistemas();
  }, [loadSistemas]);

  // Cleanup do timeout de busca ao desmontar
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Definir colunas da tabela
  const tableColumns = [
    { key: 'nome', label: 'Nome' }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (sistema) => (
    <>
      <EditButton
        onClick={() => handleEdit(sistema)}
        title="Editar"
      />
      <DeleteButton
        onClick={() => confirmDelete(sistema)}
        title="Deletar"
      />
    </>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="sistemas-listing-section">
              <div className="cadastro-listing-page-header">
                <div className="cadastro-listing-header-content">
                  <div className="cadastro-listing-header-left">
                    <div className="cadastro-listing-header-icon">
                      <i className="fas fa-server" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-listing-page-title">Cadastro de Sistemas</h1>
                      <p className="cadastro-listing-page-subtitle">
                        Gerencie os sistemas cadastrados no sistema
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtro de busca e botão adicionar */}
              <div className="listing-controls">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Buscar sistema por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewSistema}
                    icon="fas fa-plus"
                  >
                    Novo Sistema
                  </ButtonPrimary>
                </div>
              </div>

              {/* Lista de sistemas */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando sistemas..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={sistemas}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhum sistema encontrado"
                    emptyIcon="fa-server"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalSistemas}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="sistemas"
              />
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSistemaToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          sistemaToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar o sistema{' '}
                <strong>{sistemaToDelete.nome}</strong>?
              </p>
              <p className="warning-text">
                Esta ação não pode ser desfeita.
              </p>
            </>
          ) : null
        }
        confirmText="Deletar"
        cancelText="Cancelar"
        confirmButtonClass="btn-danger"
        loading={deleteLoading}
      />
    </Layout>
  );
};

export default CadastroSistemas;
