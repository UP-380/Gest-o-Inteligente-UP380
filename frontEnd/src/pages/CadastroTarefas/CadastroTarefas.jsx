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
import PageHeader from '../../components/common/PageHeader';
import { useToast } from '../../hooks/useToast';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import './CadastroTarefas.css';

const API_BASE_URL = '/api';

const CadastroTarefas = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTarefas, setTotalTarefas] = useState(0);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tarefaToDelete, setTarefaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar tarefas
  const loadTarefas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/tarefa?${params}`, {
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
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/tarefa existe no backend. Status: ${response.status}`);
        }
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setTarefas(result.data || []);
        setTotalTarefas(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar tarefas');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas:', error);
      const errorMessage = error.message || 'Erro ao carregar tarefas. Tente novamente.';
      showToast('error', errorMessage);
      setTarefas([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  // Deletar tarefa
  const handleDelete = useCallback(async () => {
    if (!tarefaToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tarefa/${tarefaToDelete.id}`, {
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
        showToast('success', 'Tarefa deletada com sucesso!');
        setShowDeleteModal(false);
        setTarefaToDelete(null);
        await loadTarefas();
      } else {
        throw new Error(result.error || 'Erro ao deletar tarefa');
      }
    } catch (error) {
      console.error('Erro ao deletar tarefa:', error);
      showToast('error', error.message || 'Erro ao deletar tarefa. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [tarefaToDelete, loadTarefas, showToast]);

  // Navegar para nova tarefa
  const handleNewTarefa = () => {
    navigate('/cadastro/tarefa', { state: { from: '/cadastro/tarefas' } });
  };

  // Navegar para edição
  const handleEdit = (tarefa) => {
    navigate(`/cadastro/tarefa?id=${tarefa.id}`, { state: { from: '/cadastro/tarefas' } });
  };

  // Confirmar exclusão
  const confirmDelete = (tarefa) => {
    setTarefaToDelete(tarefa);
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
    loadTarefas();
  }, [loadTarefas]);

  // Definir colunas da tabela
  const tableColumns = [
    { key: 'nome', label: 'Nome' },
    { 
      key: 'clickup_id', 
      label: 'ClickUp ID',
      render: (tarefa) => tarefa.clickup_id || '-'
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (tarefa) => (
    <>
      <EditButton
        onClick={() => handleEdit(tarefa)}
        title="Editar"
      />
      <DeleteButton
        onClick={() => confirmDelete(tarefa)}
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
              <PageHeader 
                title="Cadastro de Tarefas"
                subtitle="Gerencie as tarefas cadastradas no sistema"
              />

              {/* Filtro de busca e botão adicionar */}
              <div className="listing-controls">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Buscar tarefa por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewTarefa}
                    icon="fas fa-plus"
                  >
                    Nova Tarefa
                  </ButtonPrimary>
                </div>
              </div>

              {/* Lista de tarefas */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando tarefas..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={tarefas}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhuma tarefa encontrada"
                    emptyIcon="fa-tasks"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalTarefas}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="tarefas"
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
          setTarefaToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          tarefaToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar a tarefa{' '}
                <strong>{tarefaToDelete.nome}</strong>?
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

export default CadastroTarefas;

