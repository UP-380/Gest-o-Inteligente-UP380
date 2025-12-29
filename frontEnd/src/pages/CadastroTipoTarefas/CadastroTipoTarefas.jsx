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
import './CadastroTipoTarefas.css';

const API_BASE_URL = '/api';

const CadastroTipoTarefas = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [tipoTarefas, setTipoTarefas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTipoTarefas, setTotalTipoTarefas] = useState(0);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipoTarefaToDelete, setTipoTarefaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar tipos de tarefa
  const loadTipoTarefas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/tipo-tarefa?${params}`, {
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
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/tipo-tarefa existe no backend. Status: ${response.status}`);
        }
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setTipoTarefas(result.data || []);
        setTotalTipoTarefas(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar tipos de tarefa');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tipos de tarefa:', error);
      const errorMessage = error.message || 'Erro ao carregar tipos de tarefa. Tente novamente.';
      showToast('error', errorMessage);
      setTipoTarefas([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  // Deletar tipo de tarefa
  const handleDelete = useCallback(async () => {
    if (!tipoTarefaToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-tarefa/${tipoTarefaToDelete.id}`, {
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
        showToast('success', 'Tipo de tarefa deletado com sucesso!');
        setShowDeleteModal(false);
        setTipoTarefaToDelete(null);
        await loadTipoTarefas();
      } else {
        throw new Error(result.error || 'Erro ao deletar tipo de tarefa');
      }
    } catch (error) {
      console.error('Erro ao deletar tipo de tarefa:', error);
      showToast('error', error.message || 'Erro ao deletar tipo de tarefa. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [tipoTarefaToDelete, loadTipoTarefas, showToast]);

  // Navegar para novo tipo de tarefa
  const handleNewTipoTarefa = () => {
    navigate('/cadastro/tipo-tarefa', { state: { from: '/cadastro/tipo-tarefas' } });
  };

  // Navegar para edição
  const handleEdit = (tipoTarefa) => {
    navigate(`/cadastro/tipo-tarefa?id=${tipoTarefa.id}`, { state: { from: '/cadastro/tipo-tarefas' } });
  };

  // Confirmar exclusão
  const confirmDelete = (tipoTarefa) => {
    setTipoTarefaToDelete(tipoTarefa);
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
    loadTipoTarefas();
  }, [loadTipoTarefas]);

  // Definir colunas da tabela
  const tableColumns = [
    { key: 'nome', label: 'Nome' },
    { 
      key: 'clickup_id', 
      label: 'ClickUp ID',
      render: (tipoTarefa) => tipoTarefa.clickup_id || '-'
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (tipoTarefa) => (
    <>
      <EditButton
        onClick={() => handleEdit(tipoTarefa)}
        title="Editar"
      />
      <DeleteButton
        onClick={() => confirmDelete(tipoTarefa)}
        title="Deletar"
      />
    </>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="tipo-tarefas-listing-section">
              <PageHeader 
                title="Cadastro de Tipo de Tarefas"
                subtitle="Gerencie os tipos de tarefa cadastrados no sistema"
              />

              {/* Filtro de busca e botão adicionar */}
              <div className="listing-controls">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Buscar tipo de tarefa por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewTipoTarefa}
                    icon="fas fa-plus"
                  >
                    Novo Tipo de Tarefa
                  </ButtonPrimary>
                </div>
              </div>

              {/* Lista de tipos de tarefa */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando tipos de tarefa..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={tipoTarefas}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhum tipo de tarefa encontrado"
                    emptyIcon="fa-list-alt"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalTipoTarefas}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="tipos de tarefa"
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
          setTipoTarefaToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          tipoTarefaToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar o tipo de tarefa{' '}
                <strong>{tipoTarefaToDelete.nome}</strong>?
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

export default CadastroTipoTarefas;

