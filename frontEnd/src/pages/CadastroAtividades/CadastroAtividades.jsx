import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import AtividadeModal from '../../components/atividades/AtividadeModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import './CadastroAtividades.css';

const API_BASE_URL = '/api';

const CadastroAtividades = () => {
  const showToast = useToast();
  
  // Estados principais
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAtividades, setTotalAtividades] = useState(0);

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
  const [atividadeToDelete, setAtividadeToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar atividades
  const loadAtividades = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      console.log('📡 Fazendo requisição para:', `${API_BASE_URL}/atividades?${params}`);
      
      const response = await fetch(`${API_BASE_URL}/atividades?${params}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Resposta recebida - Status:', response.status);

      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({ message: 'Não autenticado' }));
        console.error('❌ Não autenticado:', errorData);
        window.location.href = '/login';
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Resposta não é JSON! Status:', response.status);
        console.error('❌ Content-Type:', contentType);
        console.error('❌ Body (primeiros 500 chars):', text.substring(0, 500));
        
        if (contentType.includes('text/html')) {
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/atividades existe no backend. Status: ${response.status}`);
        }
        
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error('❌ Erro na resposta:', errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📥 Resposta recebida:', result);
      console.log('📥 Primeira atividade (se houver):', result.data?.[0]);
      console.log('📥 clickup_id da primeira atividade:', result.data?.[0]?.clickup_id);

      if (result.success) {
        setAtividades(result.data || []);
        setTotalAtividades(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar atividades');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar atividades:', error);
      const errorMessage = error.message || 'Erro ao carregar atividades. Tente novamente.';
      showToast('error', errorMessage);
      setAtividades([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  // Carregar atividade por ID para edição
  const loadAtividadeParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/atividades/${id}`, {
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
          nome: result.data.nome || ''
        });
        setEditingId(id);
        setShowForm(true);
        setFormErrors({});
      } else {
        throw new Error(result.error || 'Erro ao carregar atividade');
      }
    } catch (error) {
      console.error('Erro ao carregar atividade:', error);
      showToast('error', 'Erro ao carregar atividade. Tente novamente.');
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

  // Salvar atividade (criar ou atualizar)
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
        ? `${API_BASE_URL}/atividades/${editingId}`
        : `${API_BASE_URL}/atividades`;
      
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
        const errorMsg = result.error || result.details || result.message || `Erro HTTP ${response.status}`;
        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        showToast(
          'success',
          editingId 
            ? 'Atividade atualizada com sucesso!'
            : 'Atividade criada com sucesso!'
        );
        resetForm();
        await loadAtividades();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar atividade';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar atividade:', error);
      const errorMsg = error.message || 'Erro ao salvar atividade. Verifique sua conexão e tente novamente.';
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar atividade
  const handleDelete = useCallback(async () => {
    if (!atividadeToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/atividades/${atividadeToDelete.id}`, {
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
        showToast('success', 'Atividade deletada com sucesso!');
        setShowDeleteModal(false);
        setAtividadeToDelete(null);
        await loadAtividades();
      } else {
        throw new Error(result.error || 'Erro ao deletar atividade');
      }
    } catch (error) {
      console.error('Erro ao deletar atividade:', error);
      showToast('error', error.message || 'Erro ao deletar atividade. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [atividadeToDelete, loadAtividades, showToast]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      nome: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
  };

  // Abrir formulário para nova atividade
  const handleNewAtividade = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (atividade) => {
    loadAtividadeParaEdicao(atividade.id);
  };

  // Confirmar exclusão
  const confirmDelete = (atividade) => {
    setAtividadeToDelete(atividade);
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
    loadAtividades();
  }, [loadAtividades]);

  // Definir colunas da tabela
  const tableColumns = [
    { key: 'nome', label: 'Nome' },
    { 
      key: 'created_at', 
      label: 'Criado em',
      render: (item) => formatDate(item.created_at, true)
    },
    { 
      key: 'updated_at', 
      label: 'Atualizado em',
      render: (item) => formatDate(item.updated_at, true)
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (atividade) => (
    <>
      <button
        className="btn-icon btn-edit"
        onClick={() => handleEdit(atividade)}
        title="Editar"
        disabled={showForm}
      >
        <i className="fas fa-edit"></i>
      </button>
      <button
        className="btn-icon btn-delete"
        onClick={() => confirmDelete(atividade)}
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
            <div className="atividades-listing-section">
              <PageHeader 
                title="Cadastro de Atividades"
                subtitle="Gerencie as atividades do sistema"
              />

              {/* Filtro de busca e botão adicionar */}
              <div className="listing-controls">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Buscar atividade por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewAtividade}
                    disabled={showForm}
                    icon="fas fa-plus"
                  >
                    Nova Atividade
                  </ButtonPrimary>
                </div>
              </div>

          {/* Modal de cadastro/edição */}
          <AtividadeModal
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

              {/* Lista de atividades */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando atividades..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={atividades}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhuma atividade encontrada"
                    emptyIcon="fa-tasks"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalAtividades}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="atividades"
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
          setAtividadeToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          atividadeToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar a atividade{' '}
                <strong>{atividadeToDelete.nome}</strong>?
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

export default CadastroAtividades;

