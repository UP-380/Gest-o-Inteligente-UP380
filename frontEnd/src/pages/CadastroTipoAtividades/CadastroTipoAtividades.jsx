import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import TipoAtividadeModal from '../../components/tipo-atividades/TipoAtividadeModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import './CadastroTipoAtividades.css';

const API_BASE_URL = '/api';

const CadastroTipoAtividades = () => {
  const showToast = useToast();
  
  // Estados principais
  const [tipoAtividades, setTipoAtividades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTipoAtividades, setTotalTipoAtividades] = useState(0);

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
  const [tipoAtividadeToDelete, setTipoAtividadeToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar tipos de atividade
  const loadTipoAtividades = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/tipo-atividade?${params}`, {
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
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/tipo-atividade existe no backend. Status: ${response.status}`);
        }
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setTipoAtividades(result.data || []);
        setTotalTipoAtividades(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar tipos de atividade');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tipos de atividade:', error);
      const errorMessage = error.message || 'Erro ao carregar tipos de atividade. Tente novamente.';
      showToast('error', errorMessage);
      setTipoAtividades([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  // Carregar tipo de atividade por ID para edição
  const loadTipoAtividadeParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-atividade/${id}`, {
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
        throw new Error(result.error || 'Erro ao carregar tipo de atividade');
      }
    } catch (error) {
      console.error('Erro ao carregar tipo de atividade:', error);
      showToast('error', 'Erro ao carregar tipo de atividade. Tente novamente.');
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

  // Salvar tipo de atividade (criar ou atualizar)
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
        ? `${API_BASE_URL}/tipo-atividade/${editingId}`
        : `${API_BASE_URL}/tipo-atividade`;
      
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
            ? 'Tipo de atividade atualizado com sucesso!'
            : 'Tipo de atividade criado com sucesso!'
        );
        resetForm();
        await loadTipoAtividades();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar tipo de atividade';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar tipo de atividade:', error);
      const errorMsg = error.message || 'Erro ao salvar tipo de atividade. Verifique sua conexão e tente novamente.';
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar tipo de atividade
  const handleDelete = useCallback(async () => {
    if (!tipoAtividadeToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-atividade/${tipoAtividadeToDelete.id}`, {
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
        showToast('success', 'Tipo de atividade deletado com sucesso!');
        setShowDeleteModal(false);
        setTipoAtividadeToDelete(null);
        await loadTipoAtividades();
      } else {
        throw new Error(result.error || 'Erro ao deletar tipo de atividade');
      }
    } catch (error) {
      console.error('Erro ao deletar tipo de atividade:', error);
      showToast('error', error.message || 'Erro ao deletar tipo de atividade. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [tipoAtividadeToDelete, loadTipoAtividades, showToast]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      nome: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
  };

  // Abrir formulário para novo tipo de atividade
  const handleNewTipoAtividade = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (tipoAtividade) => {
    loadTipoAtividadeParaEdicao(tipoAtividade.id);
  };

  // Confirmar exclusão
  const confirmDelete = (tipoAtividade) => {
    setTipoAtividadeToDelete(tipoAtividade);
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
    loadTipoAtividades();
  }, [loadTipoAtividades]);

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
  const renderTableActions = (tipoAtividade) => (
    <>
      <button
        className="btn-icon btn-edit"
        onClick={() => handleEdit(tipoAtividade)}
        title="Editar"
        disabled={showForm}
      >
        <i className="fas fa-edit"></i>
      </button>
      <button
        className="btn-icon btn-delete"
        onClick={() => confirmDelete(tipoAtividade)}
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
            <div className="tipo-atividades-listing-section">
              <PageHeader 
                title="Cadastro de Tipos de Atividade"
                subtitle="Gerencie os tipos de atividade do sistema"
              />

              {/* Filtro de busca e botão adicionar */}
              <div className="listing-controls">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Buscar tipo de atividade por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewTipoAtividade}
                    disabled={showForm}
                    icon="fas fa-plus"
                  >
                    Novo Tipo de Atividade
                  </ButtonPrimary>
                </div>
              </div>

              {/* Modal de cadastro/edição */}
              <TipoAtividadeModal
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

              {/* Lista de tipos de atividade */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando tipos de atividade..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={tipoAtividades}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhum tipo de atividade encontrado"
                    emptyIcon="fa-tags"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalTipoAtividades}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="tipos de atividade"
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
          setTipoAtividadeToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          tipoAtividadeToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar o tipo de atividade{' '}
                <strong>{tipoAtividadeToDelete.nome}</strong>?
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

export default CadastroTipoAtividades;

