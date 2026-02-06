import React, { useState, useEffect, useCallback, useRef } from 'react';
import ClienteSistemaModal from './ClienteSistemaModal';
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
 * Componente de lista de sistemas do cliente
 */
const ClienteSistemasList = ({ clienteId, clienteNome, initialData, onDataUsed }) => {
  const showToast = useToast();
  
  // Estados principais
  const [sistemas, setSistemas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSistemas, setTotalSistemas] = useState(0);
  const [sistemasOptions, setSistemasOptions] = useState([]);

  // Estados para formulário
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    sistema_id: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sistemaToDelete, setSistemaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Estado para controlar visibilidade de senhas
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());

  // Carregar sistemas disponíveis
  const loadSistemasOptions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sistemas?limit=1000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setSistemasOptions(result.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar sistemas:', error);
    }
  }, []);

  // Carregar sistemas do cliente
  const loadSistemas = useCallback(async () => {
    if (!clienteId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}/sistemas?${params}`, {
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
        setSistemas(result.data || []);
        setTotalSistemas(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar sistemas');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar sistemas:', error);
      showToast('error', error.message || 'Erro ao carregar sistemas. Tente novamente.');
      setSistemas([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, currentPage, itemsPerPage, showToast]);

  // Efeito para pré-preencher formulário quando initialData for fornecido (clonagem)
  useEffect(() => {
    if (initialData && !showForm) {
      const sistema = initialData.cp_sistema || {};
      setFormData({
        sistema_id: sistema.id || '',
        servidor: initialData.servidor || '',
        usuario_servidor: initialData.usuario_servidor || '',
        senha_servidor: initialData.senha_servidor || '',
        vpn: initialData.vpn || '',
        usuario_vpn: initialData.usuario_vpn || '',
        senha_vpn: initialData.senha_vpn || '',
        usuario_sistema: initialData.usuario_sistema || '',
        senha_sistema: initialData.senha_sistema || '',
        link_acesso: initialData.link_acesso || '',
        observacoes: initialData.observacoes || ''
      });
      setEditingId(null); // Sempre criar novo, não editar
      setShowForm(true);
      setFormErrors({});
      if (onDataUsed) {
        onDataUsed();
      }
    }
  }, [initialData, showForm, onDataUsed]);

  // Carregar sistema para edição
  const loadSistemaParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes-sistemas/${id}`, {
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
          sistema_id: result.data.sistema_id || '',
          servidor: result.data.servidor || '',
          usuario_servidor: result.data.usuario_servidor || '',
          senha_servidor: result.data.senha_servidor || '',
          vpn: result.data.vpn || '',
          usuario_vpn: result.data.usuario_vpn || '',
          senha_vpn: result.data.senha_vpn || '',
          usuario_sistema: result.data.usuario_sistema || '',
          senha_sistema: result.data.senha_sistema || '',
          link_acesso: result.data.link_acesso || '',
          observacoes: result.data.observacoes || ''
        });
        setEditingId(id);
        setShowForm(true);
        setFormErrors({});
      } else {
        throw new Error(result.error || 'Erro ao carregar sistema');
      }
    } catch (error) {
      console.error('Erro ao carregar sistema:', error);
      showToast('error', 'Erro ao carregar sistema. Tente novamente.');
    }
  }, [showToast]);

  // Salvar sistema (criar ou atualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.sistema_id) {
      showToast('error', 'Sistema é obrigatório');
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    try {
      const payload = {
        cliente_id: clienteId,
        sistema_id: formData.sistema_id,
        servidor: formData.servidor || null,
        usuario_servidor: formData.usuario_servidor || null,
        senha_servidor: formData.senha_servidor || null,
        vpn: formData.vpn || null,
        usuario_vpn: formData.usuario_vpn || null,
        senha_vpn: formData.senha_vpn || null,
        usuario_sistema: formData.usuario_sistema || null,
        senha_sistema: formData.senha_sistema || null,
        link_acesso: formData.link_acesso || null,
        observacoes: formData.observacoes || null
      };

      const url = editingId 
        ? `${API_BASE_URL}/clientes-sistemas/${editingId}`
        : `${API_BASE_URL}/clientes-sistemas`;
      
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
            ? 'Sistema atualizado com sucesso!'
            : 'Sistema vinculado com sucesso!'
        );
        resetForm();
        await loadSistemas();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar sistema';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar sistema:', error);
      showToast('error', error.message || 'Erro ao salvar sistema. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar sistema
  const handleDelete = useCallback(async () => {
    if (!sistemaToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/clientes-sistemas/${sistemaToDelete.id}`, {
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
        showToast('success', 'Sistema removido com sucesso!');
        setShowDeleteModal(false);
        setSistemaToDelete(null);
        await loadSistemas();
      } else {
        throw new Error(result.error || 'Erro ao deletar sistema');
      }
    } catch (error) {
      console.error('Erro ao deletar sistema:', error);
      showToast('error', error.message || 'Erro ao deletar sistema. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [sistemaToDelete, loadSistemas, showToast]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      sistema_id: '',
      servidor: '',
      usuario_servidor: '',
      senha_servidor: '',
      vpn: '',
      usuario_vpn: '',
      senha_vpn: '',
      usuario_sistema: '',
      senha_sistema: '',
      link_acesso: '',
      observacoes: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
  };

  // Abrir formulário para novo sistema
  const handleNewSistema = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (sistema) => {
    loadSistemaParaEdicao(sistema.id);
  };

  // Confirmar exclusão
  const confirmDelete = (sistema) => {
    setSistemaToDelete(sistema);
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
    loadSistemasOptions();
  }, [loadSistemasOptions]);

  useEffect(() => {
    loadSistemas();
  }, [loadSistemas]);

  // Toggle visibilidade de senhas
  const togglePasswordVisibility = (sistemaId) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sistemaId)) {
        newSet.delete(sistemaId);
      } else {
        newSet.add(sistemaId);
      }
      return newSet;
    });
  };

  // Definir colunas da tabela
  const tableColumns = [
    { 
      key: 'sistema', 
      label: 'Sistema',
      render: (item) => {
        const sistema = item.cp_sistema || (item.sistema_id && sistemasOptions.find(s => s.id === item.sistema_id));
        return sistema ? sistema.nome : '-';
      }
    },
    { key: 'servidor', label: 'Servidor', render: (item) => item.servidor || '-' },
    { key: 'usuario_servidor', label: 'Usuário do Servidor', render: (item) => item.usuario_servidor || '-' },
    { key: 'vpn', label: 'VPN', render: (item) => item.vpn || '-' },
    { key: 'usuario_vpn', label: 'Usuário VPN', render: (item) => item.usuario_vpn || '-' },
    { 
      key: 'senha_vpn', 
      label: 'Senha VPN', 
      render: (item) => {
        if (!item.senha_vpn) return '-';
        return visiblePasswords.has(item.id) ? item.senha_vpn : '••••••••';
      }
    },
    { key: 'usuario_sistema', label: 'Usuário do Sistema', render: (item) => item.usuario_sistema || '-' },
    { 
      key: 'senha_sistema', 
      label: 'Senha do Sistema', 
      render: (item) => {
        if (!item.senha_sistema) return '-';
        return visiblePasswords.has(item.id) ? item.senha_sistema : '••••••••';
      }
    }
  ];

  // Função para clonar sistema
  const handleClone = useCallback((sistema) => {
    const sistemaObj = sistema.cp_sistema || {};
    setFormData({
      sistema_id: sistemaObj.id || '',
      servidor: sistema.servidor || '',
      usuario_servidor: sistema.usuario_servidor || '',
      senha_servidor: sistema.senha_servidor || '',
      vpn: sistema.vpn || '',
      usuario_vpn: sistema.usuario_vpn || '',
      senha_vpn: sistema.senha_vpn || '',
      usuario_sistema: sistema.usuario_sistema || '',
      senha_sistema: sistema.senha_sistema || '',
      link_acesso: sistema.link_acesso || '',
      observacoes: sistema.observacoes || ''
    });
    setEditingId(null); // Sempre criar novo, não editar
    setShowForm(true);
    setFormErrors({});
  }, []);

  // Renderizar ações da tabela
  const renderTableActions = (sistema) => {
    const isPasswordVisible = visiblePasswords.has(sistema.id);
    
    return (
      <>
        <button
          className="btn-icon"
          onClick={() => togglePasswordVisibility(sistema.id)}
          title={isPasswordVisible ? 'Ocultar senhas' : 'Mostrar senhas'}
          disabled={showForm}
          style={{
            fontSize: '16px'
          }}
        >
          <i className={`fas ${isPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
        </button>
        <button
          className="btn-icon"
          onClick={() => handleClone(sistema)}
          title="Clonar sistema"
          disabled={showForm}
          style={{
            fontSize: '16px',
            color: '#64748b'
          }}
        >
          <i className="fas fa-clone"></i>
        </button>
        <EditButton
          onClick={() => handleEdit(sistema)}
          title="Editar"
          disabled={showForm}
        />
        <DeleteButton
          onClick={() => confirmDelete(sistema)}
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
            Sistemas
          </h3>
          {clienteNome && (
            <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
              Cliente: {clienteNome}
            </p>
          )}
        </div>
        <ButtonPrimary
          onClick={handleNewSistema}
          disabled={showForm}
          icon="fas fa-plus"
        >
          Novo Sistema
        </ButtonPrimary>
      </div>

      {/* Lista de sistemas */}
      <div style={{ marginBottom: '20px' }}>
        {loading ? (
          <LoadingState message="Carregando sistemas..." />
        ) : (
          <DataTable
            columns={tableColumns}
            data={sistemas}
            renderActions={renderTableActions}
            emptyMessage="Nenhum sistema encontrado"
            emptyIcon="fa-server"
          />
        )}
      </div>

      {/* Controles de Paginação */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalSistemas}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        loading={loading}
        itemName="sistemas"
      />

      {/* Modal de cadastro/edição */}
      <ClienteSistemaModal
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
        sistemas={sistemasOptions}
      />

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSistemaToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          sistemaToDelete ? (
            <>
              <p>
                Tem certeza que deseja remover este sistema do cliente?
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

export default ClienteSistemasList;

