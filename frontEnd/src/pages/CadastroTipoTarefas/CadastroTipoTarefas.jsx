import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import TipoTarefaModal from '../../components/tipo-tarefas/TipoTarefaModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import './CadastroTipoTarefas.css';

const API_BASE_URL = '/api';

const CadastroTipoTarefas = () => {
  const showToast = useToast();
  
  // Estados principais
  const [tipoTarefas, setTipoTarefas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTipoTarefas, setTotalTipoTarefas] = useState(0);

  // Estados para formulário
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nome: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

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

      // Verificar se a resposta é JSON
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

  // Carregar tipo de tarefa por ID para edição
  const loadTipoTarefaParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-tarefa/${id}`, {
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setFormData({
          nome: result.data.name || result.data.nome || ''
        });
        setEditingId(id);
        setShowForm(true);
        setFormErrors({});
      } else {
        throw new Error(result.error || 'Erro ao carregar tipo de tarefa');
      }
    } catch (error) {
      console.error('Erro ao carregar tipo de tarefa:', error);
      showToast('error', 'Erro ao carregar tipo de tarefa. Tente novamente.');
    }
  }, [showToast]);

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    const nomeValue = formData.nome ? String(formData.nome).trim() : '';
    if (!nomeValue) {
      errors.nome = 'Nome é obrigatório';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Salvar tipo de tarefa (criar ou atualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    const nomeValue = formData.nome ? String(formData.nome).trim() : '';

    // Validar
    if (!nomeValue) {
      showToast('error', 'Nome é obrigatório');
      return;
    }

    setSubmitting(true);

    try {
      // Preparar payload - nome e clickup_id (obrigatório no banco)
      const payload = {
        nome: nomeValue,
        clickup_id: '' // Valor padrão vazio para clickup_id obrigatório
      };

      const url = editingId 
        ? `${API_BASE_URL}/tipo-tarefa/${editingId}`
        : `${API_BASE_URL}/tipo-tarefa`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        const errorMsg = text || `Erro no servidor. Status: ${response.status}`;
        showToast('error', errorMsg);
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Erro na resposta:', result);
        const errorMsg = result.error || result.details || result.message || result.hint || `Erro HTTP ${response.status}`;
        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        showToast(
          'success',
          editingId 
            ? 'Tipo de tarefa atualizado com sucesso!'
            : 'Tipo de tarefa criado com sucesso!'
        );
        resetForm();
        await loadTipoTarefas();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar tipo de tarefa';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar tipo de tarefa:', error);
      const errorMsg = error.message || 'Erro ao salvar tipo de tarefa. Verifique sua conexão e tente novamente.';
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

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

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      nome: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
  };

  // Abrir formulário para novo tipo de tarefa
  const handleNewTipoTarefa = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (tipoTarefa) => {
    loadTipoTarefaParaEdicao(tipoTarefa.id);
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
      key: 'created_at', 
      label: 'Criado em',
      render: (item) => formatDate(item.created_at, false)
    },
    { 
      key: 'updated_at', 
      label: 'Atualizado em',
      render: (item) => formatDate(item.updated_at, false)
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (tipoTarefa) => (
    <>
      <button
        className="btn-icon btn-edit"
        onClick={() => handleEdit(tipoTarefa)}
        title="Editar"
        disabled={showForm}
      >
        <i className="fas fa-edit"></i>
      </button>
      <button
        className="btn-icon btn-delete"
        onClick={() => confirmDelete(tipoTarefa)}
        title="Deletar"
        disabled={showForm}
      >
        <i className="fas fa-trash"></i>
      </button>
    </>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="tipo-tarefas-listing-section">
              <PageHeader 
                title="Cadastro de Tipos de Tarefa"
                subtitle="Gerencie os tipos de tarefa do sistema"
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
                    disabled={showForm}
                    icon="fas fa-plus"
                  >
                    Novo Tipo de Tarefa
                  </ButtonPrimary>
                </div>
              </div>

              {/* Modal de cadastro/edição */}
              <TipoTarefaModal
                isOpen={showForm}
                onClose={resetForm}
                onSubmit={handleSubmit}
                formData={formData}
                setFormData={setFormData}
                formErrors={formErrors}
                setFormErrors={setFormErrors}
                submitting={submitting}
                editingId={editingId}
              />

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
                    emptyIcon="fa-tags"
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

