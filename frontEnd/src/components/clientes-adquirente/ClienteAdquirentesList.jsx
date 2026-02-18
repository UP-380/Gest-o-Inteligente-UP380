import React, { useState, useEffect, useCallback, useRef } from 'react';
import ClienteAdquirenteModal from './ClienteAdquirenteModal';
import ConfirmModal from '../common/ConfirmModal';
import SearchInput from '../common/SearchInput';
import DataTable from '../common/DataTable';
import Pagination from '../common/Pagination';
import LoadingState from '../common/LoadingState';
import ButtonPrimary from '../common/ButtonPrimary';
import EditButton from '../common/EditButton';
import DeleteButton from '../common/DeleteButton';
import { useToast } from '../../hooks/useToast';

const API_BASE_URL = '/api';

/**
 * Componente de lista de adquirentes do cliente
 */
const ClienteAdquirentesList = ({ clienteId, clienteNome, initialData, onDataUsed }) => {
  const showToast = useToast();

  // Estados principais
  const [adquirentes, setAdquirentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAdquirentes, setTotalAdquirentes] = useState(0);
  const [adquirentesOptions, setAdquirentesOptions] = useState([]);

  // Estados para formulário
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    adquirente_id: '',
    email: '',
    usuario: '',
    senha: '',
    estabelecimento: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adquirenteToDelete, setAdquirenteToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Estado para controlar visibilidade de senhas
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());

  // Efeito para lidar com clonagem (initialData)
  useEffect(() => {
    if (initialData) {
      setFormData({
        adquirente_id: initialData.adquirente_id || '',
        email: initialData['e-mail'] || '',
        usuario: initialData.usuario || '',
        senha: initialData.senha || '',
        estabelecimento: initialData.estabelecimento || ''
      });
      setEditingId(null); // Garante que é uma nova entrada ao clonar
      setShowForm(true);
      setFormErrors({});

      if (onDataUsed) {
        onDataUsed();
      }
    }
  }, [initialData, onDataUsed]);

  // Carregar adquirentes disponíveis
  const loadAdquirentesOptions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/adquirentes?limit=1000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAdquirentesOptions(result.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar adquirentes:', error);
    }
  }, []);

  // Carregar adquirentes do cliente
  const loadAdquirentes = useCallback(async () => {
    if (!clienteId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}/adquirentes?${params}`, {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setAdquirentes(result.data || []);
        setTotalAdquirentes(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar adquirentes');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar adquirentes:', error);
      showToast('error', error.message || 'Erro ao carregar adquirentes. Tente novamente.');
      setAdquirentes([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, currentPage, itemsPerPage, showToast]);

  // Carregar adquirente para edição
  const loadAdquirenteParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes-adquirentes/${id}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setFormData({
          adquirente_id: result.data.adquirente_id || '',
          email: result.data['e-mail'] || '',
          usuario: result.data.usuario || '',
          senha: result.data.senha || '',
          estabelecimento: result.data.estabelecimento || ''
        });
        setEditingId(id);
        setShowForm(true);
        setFormErrors({});
      } else {
        throw new Error(result.error || 'Erro ao carregar adquirente');
      }
    } catch (error) {
      console.error('Erro ao carregar adquirente:', error);
      showToast('error', 'Erro ao carregar adquirente. Tente novamente.');
    }
  }, [showToast]);

  // Salvar adquirente (criar ou atualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.adquirente_id) {
      showToast('error', 'Adquirente é obrigatório');
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    try {
      const payload = {
        cliente_id: clienteId,
        adquirente_id: formData.adquirente_id,
        email: formData.email || null,
        usuario: formData.usuario || null,
        senha: formData.senha || null,
        estabelecimento: formData.estabelecimento || null
      };

      const url = editingId
        ? `${API_BASE_URL}/clientes-adquirentes/${editingId}`
        : `${API_BASE_URL}/clientes-adquirentes`;

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

      if (!response.ok) {
        const errorMsg = result.error || result.details || `Erro HTTP ${response.status}`;
        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        showToast(
          'success',
          editingId
            ? 'Adquirente atualizado com sucesso!'
            : 'Adquirente vinculado com sucesso!'
        );
        resetForm();
        await loadAdquirentes();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar adquirente';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar adquirente:', error);
      showToast('error', error.message || 'Erro ao salvar adquirente. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar adquirente
  const handleDelete = useCallback(async () => {
    if (!adquirenteToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/clientes-adquirentes/${adquirenteToDelete.id}`, {
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
        showToast('success', 'Adquirente removido com sucesso!');
        setShowDeleteModal(false);
        setAdquirenteToDelete(null);
        await loadAdquirentes();
      } else {
        throw new Error(result.error || 'Erro ao deletar adquirente');
      }
    } catch (error) {
      console.error('Erro ao deletar adquirente:', error);
      showToast('error', error.message || 'Erro ao deletar adquirente. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [adquirenteToDelete, loadAdquirentes, showToast]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      adquirente_id: '',
      email: '',
      usuario: '',
      senha: '',
      estabelecimento: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
  };

  // Abrir formulário para novo adquirente
  const handleNewAdquirente = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (adquirente) => {
    loadAdquirenteParaEdicao(adquirente.id);
  };

  // Confirmar exclusão
  const confirmDelete = (adquirente) => {
    setAdquirenteToDelete(adquirente);
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
    loadAdquirentesOptions();
  }, [loadAdquirentesOptions]);

  useEffect(() => {
    loadAdquirentes();
  }, [loadAdquirentes]);

  // Toggle visibilidade de senhas
  const togglePasswordVisibility = (adquirenteId) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(adquirenteId)) {
        newSet.delete(adquirenteId);
      } else {
        newSet.add(adquirenteId);
      }
      return newSet;
    });
  };

  // Definir colunas da tabela
  const tableColumns = [
    {
      key: 'adquirente',
      label: 'Adquirente',
      render: (item) => {
        const adquirente = item.cp_adquirente || (item.adquirente_id && adquirentesOptions.find(a => a.id === item.adquirente_id));
        return adquirente ? adquirente.nome : '-';
      }
    },
    { key: 'email', label: 'E-mail', render: (item) => item['e-mail'] || '-' },
    { key: 'usuario', label: 'Usuário', render: (item) => item.usuario || '-' },
    {
      key: 'senha',
      label: 'Senha',
      render: (item) => {
        if (!item.senha) return '-';
        return visiblePasswords.has(item.id) ? item.senha : '••••••••';
      }
    },
    { key: 'estabelecimento', label: 'Estabelecimento', render: (item) => item.estabelecimento || '-' }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (adquirente) => {
    const isPasswordVisible = visiblePasswords.has(adquirente.id);

    return (
      <>
        <button
          className="btn-icon"
          onClick={() => togglePasswordVisibility(adquirente.id)}
          title={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
          disabled={showForm}
          style={{
            fontSize: '16px'
          }}
        >
          <i className={`fas ${isPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
        </button>
        <EditButton
          onClick={() => handleEdit(adquirente)}
          title="Editar"
          disabled={showForm}
        />
        <DeleteButton
          onClick={() => confirmDelete(adquirente)}
          title="Deletar"
          disabled={showForm}
        />
      </>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
            Adquirentes
          </h3>
          {clienteNome && (
            <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
              Cliente: {clienteNome}
            </p>
          )}
        </div>
        <ButtonPrimary
          onClick={handleNewAdquirente}
          disabled={showForm}
          icon="fas fa-plus"
        >
          Novo Adquirente
        </ButtonPrimary>
      </div>

      {/* Lista de adquirentes */}
      <div style={{ marginBottom: '20px' }}>
        {loading ? (
          <LoadingState message="Carregando adquirentes..." />
        ) : (
          <DataTable
            columns={tableColumns}
            data={adquirentes}
            renderActions={renderTableActions}
            emptyMessage="Nenhum adquirente encontrado"
            emptyIcon="fa-credit-card"
          />
        )}
      </div>

      {/* Controles de Paginação */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalAdquirentes}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        loading={loading}
        itemName="adquirentes"
      />

      {/* Modal de cadastro/edição */}
      <ClienteAdquirenteModal
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        submitting={submitting}
        editingId={editingId}
        clienteId={clienteId}
        adquirentes={adquirentesOptions}
      />

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setAdquirenteToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          adquirenteToDelete ? (
            <>
              <p>
                Tem certeza que deseja remover este adquirente do cliente?
              </p>
              <p className="warning-text">
                Esta ação não pode ser desfeita.
              </p>
            </>
          ) : null
        }
        confirmText="Remover"
        cancelText="Cancelar"
        confirmButtonClass="btn-danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default ClienteAdquirentesList;

