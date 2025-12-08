import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import ProdutoModal from '../../components/produtos/ProdutoModal';
import './CadastroProdutos.css';

const API_BASE_URL = '/api';

const CadastroProdutos = () => {
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
      showMessage(errorMessage, 'error');
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

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
      showMessage('Erro ao carregar produto. Tente novamente.', 'error');
    }
  }, []);

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
      showMessage('Nome é obrigatório', 'error');
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
        showMessage(errorMsg, 'error');
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || result.details || result.message || `Erro HTTP ${response.status}`;
        showMessage(errorMsg, 'error');
        return;
      }

      if (result.success) {
        showMessage(
          editingId 
            ? 'Produto atualizado com sucesso!'
            : 'Produto criado com sucesso!',
          'success'
        );
        resetForm();
        await loadProdutos();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar produto';
        showMessage(errorMsg, 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      const errorMsg = error.message || 'Erro ao salvar produto. Verifique sua conexão e tente novamente.';
      showMessage(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar produto
  const handleDelete = useCallback(async () => {
    if (!produtoToDelete) return;

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
        showMessage('Produto deletado com sucesso!', 'success');
        setShowDeleteModal(false);
        setProdutoToDelete(null);
        await loadProdutos();
      } else {
        throw new Error(result.error || 'Erro ao deletar produto');
      }
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      showMessage(error.message || 'Erro ao deletar produto. Tente novamente.', 'error');
      setShowDeleteModal(false);
    }
  }, [produtoToDelete, loadProdutos]);

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

  // Mostrar mensagem
  const showMessage = useCallback((message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }, []);

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

  // Calcular range de itens exibidos
  const startItem = totalProdutos === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, produtos.length) - 1, totalProdutos);

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="produtos-listing-section">
              <div className="form-header">
                <h2 className="form-title">Cadastro de Produtos</h2>
                <p className="form-subtitle">
                  Gerencie os produtos do sistema
                </p>
              </div>

          {/* Filtro de busca e botão adicionar */}
          <div className="listing-controls">
            <div className="search-container">
              <div className="search-input-wrapper">
                <i className="fas fa-search search-icon"></i>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar produto por nome..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
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
              <div className="loading-container">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Carregando produtos...</span>
              </div>
            ) : produtos.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-box"></i>
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              <>
                <table className="listing-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nome</th>
                      <th>ClickUp ID</th>
                      <th>Criado em</th>
                      <th>Atualizado em</th>
                      <th className="actions-column">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((produto) => (
                      <tr key={produto.id}>
                        <td>{produto.id || '-'}</td>
                        <td>{produto.nome || '-'}</td>
                        <td>{produto.clickup_id ? String(produto.clickup_id) : '-'}</td>
                        <td>{formatDate(produto.created_at)}</td>
                        <td>{formatDate(produto.updated_at)}</td>
                        <td className="actions-column">
                          <div className="action-buttons">
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
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* Controles de Paginação */}
          {totalProdutos > 0 && (
            <div className="pagination-container" style={{ display: 'flex' }}>
              <div className="pagination-limit-selector">
                <label htmlFor="paginationLimit">Exibir:</label>
                <select 
                  id="paginationLimit" 
                  className="pagination-limit-select"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value="10">10 itens</option>
                  <option value="20">20 itens</option>
                  <option value="30">30 itens</option>
                  <option value="50">50 itens</option>
                </select>
              </div>
              
              <div className="pagination-info">
                <span>
                  Mostrando {startItem} a {endItem} de {totalProdutos} produtos
                </span>
              </div>
              
              <div className="pagination-controls">
                <button 
                  className="pagination-btn" 
                  title="Primeira página"
                  disabled={currentPage === 1 || loading}
                  onClick={() => setCurrentPage(1)}
                >
                  <i className="fas fa-angle-double-left"></i>
                </button>
                <button 
                  className="pagination-btn" 
                  title="Página anterior"
                  disabled={currentPage === 1 || loading}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <i className="fas fa-angle-left"></i>
                </button>
                
                <span className="pagination-current">
                  Página <span>{currentPage}</span> de <span>{totalPages}</span>
                </span>
                
                <button 
                  className="pagination-btn" 
                  title="Próxima página"
                  disabled={currentPage === totalPages || totalPages === 0 || loading}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <i className="fas fa-angle-right"></i>
                </button>
                <button 
                  className="pagination-btn" 
                  title="Última página"
                  disabled={currentPage === totalPages || totalPages === 0 || loading}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <i className="fas fa-angle-double-right"></i>
                </button>
              </div>
            </div>
          )}
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && produtoToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmar Exclusão</h3>
              <button
                className="btn-icon"
                onClick={() => setShowDeleteModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Tem certeza que deseja deletar o produto{' '}
                <strong>{produtoToDelete.nome}</strong>?
              </p>
              <p className="warning-text">
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
              >
                <i className="fas fa-trash"></i>
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CadastroProdutos;

