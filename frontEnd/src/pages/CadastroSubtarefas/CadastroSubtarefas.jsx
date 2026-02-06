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
import { subtarefaAPI } from '../../services/api';
import './CadastroSubtarefas.css';

const CadastroSubtarefas = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [subtarefas, setSubtarefas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSubtarefas, setTotalSubtarefas] = useState(0);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [subtarefaToDelete, setSubtarefaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar subtarefas
  const loadSubtarefas = useCallback(async () => {
    setLoading(true);
    try {
      const result = await subtarefaAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm.trim()
      });

      if (result.success) {
        setSubtarefas(result.data || []);
        setTotalSubtarefas(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar subtarefas');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar subtarefas:', error);
      const errorMessage = error.message || 'Erro ao carregar subtarefas. Tente novamente.';
      showToast('error', errorMessage);
      setSubtarefas([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  // Deletar subtarefa
  const handleDelete = useCallback(async () => {
    if (!subtarefaToDelete) return;

    setDeleteLoading(true);
    try {
      const result = await subtarefaAPI.delete(subtarefaToDelete.id);

      if (result.success) {
        showToast('success', 'Subtarefa deletada com sucesso!');
        setShowDeleteModal(false);
        setSubtarefaToDelete(null);
        await loadSubtarefas();
      } else {
        throw new Error(result.error || 'Erro ao deletar subtarefa');
      }
    } catch (error) {
      console.error('Erro ao deletar subtarefa:', error);
      showToast('error', error.message || 'Erro ao deletar subtarefa. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [subtarefaToDelete, loadSubtarefas, showToast]);

  // Navegar para nova subtarefa
  const handleNewSubtarefa = () => {
    navigate('/cadastro/subtarefa', { state: { from: '/cadastro/subtarefas' } });
  };

  // Navegar para edição
  const handleEdit = (subtarefa) => {
    navigate(`/cadastro/subtarefa?id=${subtarefa.id}`, { state: { from: '/cadastro/subtarefas' } });
  };

  // Confirmar exclusão
  const confirmDelete = (subtarefa) => {
    setSubtarefaToDelete(subtarefa);
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
    loadSubtarefas();
  }, [loadSubtarefas]);

  // Definir colunas da tabela
  const tableColumns = [
    { key: 'nome', label: 'Nome' }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (subtarefa) => (
    <>
      <EditButton
        onClick={() => handleEdit(subtarefa)}
        title="Editar"
      />
      <DeleteButton
        onClick={() => confirmDelete(subtarefa)}
        title="Deletar"
      />
    </>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="tarefas-listing-section">
              <div className="cadastro-listing-page-header">
                <div className="cadastro-listing-header-content">
                  <div className="cadastro-listing-header-left">
                    <div className="cadastro-listing-header-icon">
                      <i className="fas fa-list-ul" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-listing-page-title">Cadastro de Subtarefas</h1>
                      <p className="cadastro-listing-page-subtitle">
                        Gerencie as subtarefas cadastradas no sistema
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
                  placeholder="Buscar subtarefa por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewSubtarefa}
                    icon="fas fa-plus"
                  >
                    Nova Subtarefa
                  </ButtonPrimary>
                </div>
              </div>

              {/* Lista de subtarefas */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando subtarefas..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={subtarefas}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhuma subtarefa encontrada"
                    emptyIcon="fa-list-ul"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalSubtarefas}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="subtarefas"
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
          setSubtarefaToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          subtarefaToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar a subtarefa{' '}
                <strong>{subtarefaToDelete.nome}</strong>?
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

export default CadastroSubtarefas;

