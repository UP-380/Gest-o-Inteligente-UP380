import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import './CadastroColaboradores.css';

const API_BASE_URL = '/api';

// Função auxiliar para aplicar máscara de CPF
const aplicarMascaraCpf = (valor) => {
  const apenasNumeros = valor.replace(/\D/g, '');
  const numeroLimitado = apenasNumeros.substring(0, 11);
  return numeroLimitado
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const CadastroColaboradores = () => {
  // Estados principais
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalColaboradores, setTotalColaboradores] = useState(0);

  // Estados para formulário
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    cpf: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [colaboradorToDelete, setColaboradorToDelete] = useState(null);

  // Carregar colaboradores
  const loadColaboradores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      console.log('📡 Fazendo requisição para:', `${API_BASE_URL}/colaboradores?${params}`);
      
      const response = await fetch(`${API_BASE_URL}/colaboradores?${params}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Resposta recebida - Status:', response.status);
      console.log('📥 Content-Type:', response.headers.get('content-type'));

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
        
        // Se for HTML, pode ser erro 404 ou redirecionamento
        if (contentType.includes('text/html')) {
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/colaboradores existe no backend. Status: ${response.status}`);
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

      if (result.success) {
        setColaboradores(result.data || []);
        setTotalColaboradores(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar colaboradores');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar colaboradores:', error);
      const errorMessage = error.message || 'Erro ao carregar colaboradores. Tente novamente.';
      showMessage(errorMessage, 'error');
      setColaboradores([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  // Carregar colaborador por ID para edição
  const loadColaboradorParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${id}`, {
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
          nome: result.data.nome || '',
          cpf: result.data.cpf ? aplicarMascaraCpf(result.data.cpf) : ''
        });
        setEditingId(id);
        setShowForm(true);
        setFormErrors({});
      } else {
        throw new Error(result.error || 'Erro ao carregar colaborador');
      }
    } catch (error) {
      console.error('Erro ao carregar colaborador:', error);
      showMessage('Erro ao carregar colaborador. Tente novamente.', 'error');
    }
  }, []);

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.nome || !formData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }

    if (formData.cpf && formData.cpf.trim()) {
      const cpfLimpo = formData.cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11) {
        errors.cpf = 'CPF deve conter 11 dígitos';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Salvar colaborador (criar ou atualizar)
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        nome: formData.nome.trim(),
        cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null
      };

      const url = editingId 
        ? `${API_BASE_URL}/colaboradores/${editingId}`
        : `${API_BASE_URL}/colaboradores`;
      
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

      const result = await response.json();

      if (result.success) {
        showMessage(
          editingId 
            ? 'Colaborador atualizado com sucesso!'
            : 'Colaborador criado com sucesso!',
          'success'
        );
        resetForm();
        await loadColaboradores();
      } else {
        throw new Error(result.error || 'Erro ao salvar colaborador');
      }
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error);
      showMessage(error.message || 'Erro ao salvar colaborador. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingId, loadColaboradores]);

  // Deletar colaborador
  const handleDelete = useCallback(async () => {
    if (!colaboradorToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorToDelete.id}`, {
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
        showMessage('Colaborador deletado com sucesso!', 'success');
        setShowDeleteModal(false);
        setColaboradorToDelete(null);
        await loadColaboradores();
      } else {
        throw new Error(result.error || 'Erro ao deletar colaborador');
      }
    } catch (error) {
      console.error('Erro ao deletar colaborador:', error);
      showMessage(error.message || 'Erro ao deletar colaborador. Tente novamente.', 'error');
      setShowDeleteModal(false);
    }
  }, [colaboradorToDelete, loadColaboradores]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
  };

  // Abrir formulário para novo colaborador
  const handleNewColaborador = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (colaborador) => {
    loadColaboradorParaEdicao(colaborador.id);
  };

  // Confirmar exclusão
  const confirmDelete = (colaborador) => {
    setColaboradorToDelete(colaborador);
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
    loadColaboradores();
  }, [loadColaboradores]);

  // Calcular range de itens exibidos
  const startItem = totalColaboradores === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, colaboradores.length) - 1, totalColaboradores);

  return (
    <Layout>
      <div className="cadastro-colaboradores-container">
        <main className="colaboradores-listing-section">
          <div className="form-header">
            <h2 className="form-title">Cadastro de Colaboradores</h2>
            <p className="form-subtitle">
              Gerencie os colaboradores do sistema
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
                  placeholder="Buscar colaborador por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="listing-controls-right">
              <button
                className="btn-primary"
                onClick={handleNewColaborador}
                disabled={showForm}
              >
                <i className="fas fa-plus"></i>
                Novo Colaborador
              </button>
            </div>
          </div>

          {/* Formulário de cadastro/edição */}
          {showForm && (
            <div className="form-card">
              <div className="form-card-header">
                <h3>{editingId ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
                <button
                  className="btn-icon"
                  onClick={resetForm}
                  title="Fechar"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="colaborador-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Nome <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.nome ? 'error' : ''}`}
                      value={formData.nome}
                      onChange={(e) => {
                        setFormData({ ...formData, nome: e.target.value });
                        if (formErrors.nome) {
                          setFormErrors({ ...formErrors, nome: '' });
                        }
                      }}
                      placeholder="Digite o nome do colaborador"
                      disabled={submitting}
                    />
                    {formErrors.nome && (
                      <span className="error-message">{formErrors.nome}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">CPF</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.cpf ? 'error' : ''}`}
                      value={formData.cpf}
                      onChange={(e) => {
                        const masked = aplicarMascaraCpf(e.target.value);
                        setFormData({ ...formData, cpf: masked });
                        if (formErrors.cpf) {
                          setFormErrors({ ...formErrors, cpf: '' });
                        }
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      disabled={submitting}
                    />
                    {formErrors.cpf && (
                      <span className="error-message">{formErrors.cpf}</span>
                    )}
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        {editingId ? 'Atualizar' : 'Salvar'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de colaboradores */}
          <div className="listing-table-container">
            {loading ? (
              <div className="loading-container">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Carregando colaboradores...</span>
              </div>
            ) : colaboradores.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-users"></i>
                <p>Nenhum colaborador encontrado</p>
              </div>
            ) : (
              <>
                <table className="listing-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nome</th>
                      <th>CPF</th>
                      <th className="actions-column">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colaboradores.map((colaborador) => (
                      <tr key={colaborador.id}>
                        <td>{colaborador.id}</td>
                        <td>{colaborador.nome || '-'}</td>
                        <td>
                          {colaborador.cpf 
                            ? aplicarMascaraCpf(colaborador.cpf)
                            : '-'
                          }
                        </td>
                        <td className="actions-column">
                          <div className="action-buttons">
                            <button
                              className="btn-icon btn-edit"
                              onClick={() => handleEdit(colaborador)}
                              title="Editar"
                              disabled={showForm}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              className="btn-icon btn-delete"
                              onClick={() => confirmDelete(colaborador)}
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

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span className="pagination-info">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || loading}
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}

                {/* Info de paginação */}
                <div className="pagination-info-bottom">
                  Mostrando {startItem} a {endItem} de {totalColaboradores} colaboradores
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && colaboradorToDelete && (
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
                Tem certeza que deseja deletar o colaborador{' '}
                <strong>{colaboradorToDelete.nome}</strong>?
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

export default CadastroColaboradores;

