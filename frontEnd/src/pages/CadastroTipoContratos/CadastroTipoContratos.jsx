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
import './CadastroTipoContratos.css';

const API_BASE_URL = '/api';

const CadastroTipoContratos = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [tiposContrato, setTiposContrato] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTiposContrato, setTotalTiposContrato] = useState(0);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipoContratoToDelete, setTipoContratoToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar tipos de contrato
  const loadTiposContrato = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/tipo-contrato-membro?${params}`, {
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
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/tipo-contrato-membro existe no backend. Status: ${response.status}`);
        }
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setTiposContrato(result.data || []);
        setTotalTiposContrato(result.total || result.count || 0);
        setTotalPages(Math.ceil((result.total || result.count || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar tipos de contrato');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tipos de contrato:', error);
      const errorMessage = error.message || 'Erro ao carregar tipos de contrato. Tente novamente.';
      showToast('error', errorMessage);
      setTiposContrato([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  // Deletar tipo de contrato
  const handleDelete = useCallback(async () => {
    if (!tipoContratoToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-contrato-membro/${tipoContratoToDelete.id}`, {
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
        showToast('success', 'Tipo de contrato deletado com sucesso!');
        setShowDeleteModal(false);
        setTipoContratoToDelete(null);
        await loadTiposContrato();
      } else {
        throw new Error(result.error || result.details || 'Erro ao deletar tipo de contrato');
      }
    } catch (error) {
      console.error('Erro ao deletar tipo de contrato:', error);
      showToast('error', error.message || 'Erro ao deletar tipo de contrato. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [tipoContratoToDelete, loadTiposContrato, showToast]);

  // Navegar para novo tipo de contrato
  const handleNewTipoContrato = () => {
    navigate('/cadastro/tipo-contrato', { state: { from: '/cadastro/tipo-contratos' } });
  };

  // Navegar para edição
  const handleEdit = (tipoContrato) => {
    navigate(`/cadastro/tipo-contrato?id=${tipoContrato.id}`, { state: { from: '/cadastro/tipo-contratos' } });
  };

  // Confirmar exclusão
  const confirmDelete = (tipoContrato) => {
    setTipoContratoToDelete(tipoContrato);
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
    loadTiposContrato();
  }, [loadTiposContrato]);

  // Definir colunas da tabela
  const tableColumns = [
    { key: 'nome', label: 'Nome' }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (tipoContrato) => (
    <>
      <EditButton
        onClick={() => handleEdit(tipoContrato)}
        title="Editar"
      />
      <DeleteButton
        onClick={() => confirmDelete(tipoContrato)}
        title="Deletar"
      />
    </>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="tipo-contratos-listing-section">
              <div className="cadastro-listing-page-header">
                <div className="cadastro-listing-header-content">
                  <div className="cadastro-listing-header-left">
                    <div className="cadastro-listing-header-icon">
                      <i className="fas fa-file-contract" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-listing-page-title">Cadastro de Tipos de Contrato</h1>
                      <p className="cadastro-listing-page-subtitle">
                        Gerencie os tipos de contrato cadastrados no sistema
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
                  placeholder="Buscar tipo de contrato por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewTipoContrato}
                    icon="fas fa-plus"
                  >
                    Novo Tipo de Contrato
                  </ButtonPrimary>
                </div>
              </div>

              {/* Lista de tipos de contrato */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando tipos de contrato..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={tiposContrato}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhum tipo de contrato encontrado"
                    emptyIcon="fa-file-contract"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalTiposContrato}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="tipos de contrato"
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
          setTipoContratoToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          tipoContratoToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar o tipo de contrato{' '}
                <strong>{tipoContratoToDelete.nome}</strong>?
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

export default CadastroTipoContratos;






