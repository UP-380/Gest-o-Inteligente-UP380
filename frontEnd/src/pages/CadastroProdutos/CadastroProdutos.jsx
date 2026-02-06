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
import './CadastroProdutos.css';

const API_BASE_URL = '/api';

const CadastroProdutos = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProdutos, setTotalProdutos] = useState(0);

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

  // Navegar para novo produto
  const handleNewProduto = () => {
    navigate('/cadastro/produto', { state: { from: '/cadastro/produtos' } });
  };

  // Navegar para edição
  const handleEdit = (produto) => {
    navigate(`/cadastro/produto?id=${produto.id}`, { state: { from: '/cadastro/produtos' } });
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
    { key: 'nome', label: 'Nome' }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (produto) => (
    <>
      <EditButton
        onClick={() => handleEdit(produto)}
        title="Editar"
      />
      <DeleteButton
        onClick={() => confirmDelete(produto)}
        title="Deletar"
      />
    </>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="produtos-listing-section">
              <div className="cadastro-listing-page-header">
                <div className="cadastro-listing-header-content">
                  <div className="cadastro-listing-header-left">
                    <div className="cadastro-listing-header-icon">
                      <i className="fas fa-box" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-listing-page-title">Cadastro de Produtos</h1>
                      <p className="cadastro-listing-page-subtitle">
                        Gerencie os produtos do sistema
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
                  placeholder="Buscar produto por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewProduto}
                    icon="fas fa-plus"
                  >
                    Novo Produto
                  </ButtonPrimary>
                </div>
              </div>

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

