import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import ProdutoModal from '../../components/produtos/ProdutoModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import './CadastroProdutos.css';

const API_BASE_URL = '/api';

const CadastroProdutos = () => {
  const showToast = useToast();
  
  // Estados principais
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProdutos, setTotalProdutos] = useState(0);

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
  const [produtoToDelete, setProdutoToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar produtos
  const loadProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/produtos?${params}`, {
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
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/produtos existe no backend. Status: ${response.status}`);
        }
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setProdutos(result.data || []);
        setTotalProdutos(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar produtos');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
      const errorMessage = error.message || 'Erro ao carregar produtos. Tente novamente.';
      showToast('error', errorMessage);
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  // Carregar produto por ID para edição
  const loadProdutoParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/produtos/${id}`, {
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
        throw new Error(result.error || 'Erro ao carregar produto');
      }
    } catch (error) {
      console.error('Erro ao carregar produto:', error);
      showToast('error', 'Erro ao carregar produto. Tente novamente.');
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

  // Salvar produto (criar ou atualizar)
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
        ? `${API_BASE_URL}/produtos/${editingId}`
        : `${API_BASE_URL}/produtos`;
      
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
            ? 'Produto atualizado com sucesso!'
            : 'Produto criado com sucesso!'
        );
        resetForm();
        await loadProdutos();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar produto';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      const errorMsg = error.message || 'Erro ao salvar produto. Verifique sua conexão e tente novamente.';
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar produto
  const handleDelete = useCallback(async () => {
    if (!produtoToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/produtos/${produtoToDelete.id}`, {
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
        showToast('success', 'Produto deletado com sucesso!');
        setShowDeleteModal(false);
        setProdutoToDelete(null);
        await loadProdutos();
      } else {
        throw new Error(result.error || 'Erro ao deletar produto');
      }
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      showToast('error', error.message || 'Erro ao deletar produto. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [produtoToDelete, loadProdutos, showToast]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      nome: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
  };

  // Abrir formulário para novo produto
  const handleNewProduto = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (produto) => {
    loadProdutoParaEdicao(produto.id);
  };

  // Confirmar exclusão
  const confirmDelete = (produto) => {
    setProdutoToDelete(produto);
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
    loadProdutos();
  }, [loadProdutos]);

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
  const renderTableActions = (produto) => (
    <>
      <button
        className="btn-icon btn-edit"
        onClick={() => handleEdit(produto)}
        title="Editar"
        disabled={showForm}
      >
        <i className="fas fa-edit"></i>
      </button>
      <button
        className="btn-icon btn-delete"
        onClick={() => confirmDelete(produto)}
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
            <div className="produtos-listing-section">
              <PageHeader 
                title="Cadastro de Produtos"
                subtitle="Gerencie os produtos do sistema"
              />

              {/* Filtro de busca e botão adicionar */}
              <div className="listing-controls">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Buscar produto por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewProduto}
                    disabled={showForm}
                    icon="fas fa-plus"
                  >
                    Novo Produto
                  </ButtonPrimary>
                </div>
              </div>

          {/* Modal de cadastro/edição */}
          <ProdutoModal
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

              {/* Lista de produtos */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando produtos..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={produtos}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhum produto encontrado"
                    emptyIcon="fa-box"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalProdutos}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="produtos"
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
          setProdutoToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          produtoToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar o produto{' '}
                <strong>{produtoToDelete.nome}</strong>?
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

export default CadastroProdutos;

