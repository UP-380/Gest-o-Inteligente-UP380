import React, { useState, useEffect, useCallback, useRef } from 'react';
import ClienteContaBancariaModal from './ClienteContaBancariaModal';
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
 * Componente de lista de contas bancárias do cliente
 */
const ClienteContasBancariasList = ({ clienteId, clienteNome, initialData, onDataUsed }) => {
  const showToast = useToast();

  // Estados principais
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContas, setTotalContas] = useState(0);
  const [bancos, setBancos] = useState([]);

  // Estados para formulário
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    banco_id: '',
    agencia: '',
    conta: '',
    operador: '',
    usuario: '',
    senha: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contaToDelete, setContaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Estado para controlar visibilidade de senhas
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());

  // Estado para erro de submissão (duplicidade)
  const [submitError, setSubmitError] = useState(null);

  // Efeito para lidar com clonagem (initialData)
  useEffect(() => {
    if (initialData) {
      setFormData({
        banco_id: initialData.banco_id || '',
        agencia: initialData.agencia || '',
        conta: initialData.conta || '',
        operador: initialData.operador || '',
        usuario: initialData.usuario || '',
        senha: initialData.senha || '',
        status_cadastro: initialData.status_cadastro || '',
        status_acesso: initialData.status_acesso || '',
        observacoes: initialData.observacoes || '',
        chave_acesso: initialData.chave_acesso || '',
        senha_4digitos: initialData.senha_4digitos || '',
        senha_6digitos: initialData.senha_6digitos || '',
        senha_8digitos: initialData.senha_8digitos || '',
        link_acesso: initialData.link_acesso || ''
      });
      setEditingId(null); // Garante que é uma nova entrada ao clonar
      setShowForm(true);
      setFormErrors({});
      setSubmitError(null);

      if (onDataUsed) {
        onDataUsed();
      }
    }
  }, [initialData, onDataUsed]);

  // Carregar bancos
  const loadBancos = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bancos?limit=1000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setBancos(result.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar bancos:', error);
    }
  }, []);

  // Carregar contas bancárias
  const loadContas = useCallback(async () => {
    if (!clienteId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}/contas-bancarias?${params}`, {
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
        setContas(result.data || []);
        setTotalContas(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar contas bancárias');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar contas bancárias:', error);
      showToast('error', error.message || 'Erro ao carregar contas bancárias. Tente novamente.');
      setContas([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, currentPage, itemsPerPage, searchTerm, showToast]);

  // Carregar conta para edição
  const loadContaParaEdicao = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes-contas-bancarias/${id}`, {
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
          banco_id: result.data.banco_id || '',
          agencia: result.data.agencia || '',
          conta: result.data.conta || '',
          operador: result.data.operador || '',
          usuario: result.data.usuario || '',
          senha: result.data.senha || '',
          status_cadastro: result.data.status_cadastro || '',
          status_acesso: result.data.status_acesso || '',
          observacoes: result.data.observacoes || '',
          chave_acesso: result.data.chave_acesso || '',
          senha_4digitos: result.data.senha_4digitos || '',
          senha_6digitos: result.data.senha_6digitos || '',
          senha_8digitos: result.data.senha_8digitos || '',
          link_acesso: result.data.link_acesso || ''
        });
        setEditingId(id);
        setShowForm(true);
        setFormErrors({});
        setSubmitError(null);
      } else {
        throw new Error(result.error || 'Erro ao carregar conta bancária');
      }
    } catch (error) {
      console.error('Erro ao carregar conta bancária:', error);
      showToast('error', 'Erro ao carregar conta bancária. Tente novamente.');
    }
  }, [showToast]);

  // Salvar conta (criar ou atualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.banco_id) {
      showToast('error', 'Banco é obrigatório');
      return;
    }

    setSubmitting(true);
    setFormErrors({});
    setSubmitError(null);

    try {
      // Função auxiliar para limpar campos vazios
      const cleanValue = (value) => {
        if (value === undefined || value === null || value === '') {
          return null;
        }
        const trimmed = String(value).trim();
        return trimmed === '' ? null : trimmed;
      };

      const payload = {
        cliente_id: clienteId,
        banco_id: formData.banco_id,
        agencia: cleanValue(formData.agencia),
        conta: cleanValue(formData.conta),
        operador: cleanValue(formData.operador),
        usuario: cleanValue(formData.usuario),
        senha: cleanValue(formData.senha),
        status_cadastro: cleanValue(formData.status_cadastro),
        status_acesso: cleanValue(formData.status_acesso),
        observacoes: cleanValue(formData.observacoes),
        chave_acesso: cleanValue(formData.chave_acesso),
        senha_4digitos: cleanValue(formData.senha_4digitos),
        senha_6digitos: cleanValue(formData.senha_6digitos),
        senha_8digitos: cleanValue(formData.senha_8digitos),
        link_acesso: cleanValue(formData.link_acesso)
      };

      console.log('📤 Enviando payload:', { ...payload, senha: payload.senha ? '***' : null });

      const url = editingId
        ? `${API_BASE_URL}/clientes-contas-bancarias/${editingId}`
        : `${API_BASE_URL}/clientes-contas-bancarias`;

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
      console.log('📥 Resposta do servidor:', result);

      if (!response.ok) {
        const errorMsg = result.error || result.details || `Erro HTTP ${response.status}`;
        console.error('❌ Erro na resposta:', { status: response.status, error: errorMsg, result });

        // Se for erro de duplicidade (409), define mensagem específica para o modal
        if (response.status === 409) {
          setSubmitError('Duplicidade detectada: Já existe uma conta com estes dados. Altere algum campo (ex: observações) para salvar, ou verifique se este registro já existe.');
        } else {
          setSubmitError(errorMsg);
        }

        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        showToast(
          'success',
          editingId
            ? 'Conta bancária atualizada com sucesso!'
            : 'Conta bancária criada com sucesso!'
        );
        resetForm();
        await loadContas();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar conta bancária';
        console.error('❌ Erro ao salvar:', errorMsg);
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar conta bancária:', error);
      setSubmitError(error.message || 'Erro ao salvar conta bancária. Verifique sua conexão e tente novamente.');
      showToast('error', error.message || 'Erro ao salvar conta bancária. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar conta
  const handleDelete = useCallback(async () => {
    if (!contaToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/clientes-contas-bancarias/${contaToDelete.id}`, {
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
        showToast('success', 'Conta bancária deletada com sucesso!');
        setShowDeleteModal(false);
        setContaToDelete(null);
        await loadContas();
      } else {
        throw new Error(result.error || 'Erro ao deletar conta bancária');
      }
    } catch (error) {
      console.error('Erro ao deletar conta bancária:', error);
      showToast('error', error.message || 'Erro ao deletar conta bancária. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [contaToDelete, loadContas, showToast]);

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      banco_id: '',
      agencia: '',
      conta: '',
      operador: '',
      usuario: '',
      senha: '',
      status_cadastro: '',
      status_acesso: '',
      observacoes: '',
      chave_acesso: '',
      senha_4digitos: '',
      senha_6digitos: '',
      senha_8digitos: '',
      link_acesso: ''
    });
    setEditingId(null);
    setShowForm(false);
    setFormErrors({});
    setSubmitError(null);
  };

  // Abrir formulário para nova conta
  const handleNewConta = () => {
    resetForm();
    setShowForm(true);
  };

  // Abrir formulário para edição
  const handleEdit = (conta) => {
    loadContaParaEdicao(conta.id);
  };

  // Confirmar exclusão
  const confirmDelete = (conta) => {
    setContaToDelete(conta);
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
    loadBancos();
  }, [loadBancos]);

  useEffect(() => {
    loadContas();
  }, [loadContas]);

  // Toggle visibilidade de senhas
  const togglePasswordVisibility = (contaId) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contaId)) {
        newSet.delete(contaId);
      } else {
        newSet.add(contaId);
      }
      return newSet;
    });
  };

  // Definir colunas da tabela
  const tableColumns = [
    {
      key: 'banco',
      label: 'Banco',
      render: (item) => {
        const banco = item.cp_banco || (item.banco_id && bancos.find(b => b.id === item.banco_id));
        return banco ? (banco.codigo ? `${banco.codigo} - ${banco.nome}` : banco.nome) : '-';
      }
    },
    { key: 'agencia', label: 'Agência', render: (item) => item.agencia || '-' },
    { key: 'conta', label: 'Conta', render: (item) => item.conta || '-' },
    { key: 'operador', label: 'Operador', render: (item) => item.operador || '-' },
    { key: 'usuario', label: 'Usuário', render: (item) => item.usuario || '-' },
    {
      key: 'senha',
      label: 'Senha',
      render: (item) => {
        if (!item.senha) return '-';
        return visiblePasswords.has(item.id) ? item.senha : '••••••••';
      }
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (conta) => {
    const isPasswordVisible = visiblePasswords.has(conta.id);

    return (
      <>
        <button
          className="btn-icon"
          onClick={() => togglePasswordVisibility(conta.id)}
          title={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
          disabled={showForm}
          style={{
            fontSize: '16px'
          }}
        >
          <i className={`fas ${isPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
        </button>
        <EditButton
          onClick={() => handleEdit(conta)}
          title="Editar"
          disabled={showForm}
        />
        <DeleteButton
          onClick={() => confirmDelete(conta)}
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
            Contas Bancárias
          </h3>
          {clienteNome && (
            <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
              Cliente: {clienteNome}
            </p>
          )}
        </div>
        <ButtonPrimary
          onClick={handleNewConta}
          disabled={showForm}
          icon="fas fa-plus"
        >
          Nova Conta
        </ButtonPrimary>
      </div>

      {/* Filtro de busca */}
      <div style={{ marginBottom: '20px' }}>
        <SearchInput
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Buscar por agência ou conta..."
        />
      </div>

      {/* Lista de contas */}
      <div style={{ marginBottom: '20px' }}>
        {loading ? (
          <LoadingState message="Carregando contas bancárias..." />
        ) : (
          <DataTable
            columns={tableColumns}
            data={contas}
            renderActions={renderTableActions}
            emptyMessage="Nenhuma conta bancária encontrada"
            emptyIcon="fa-university"
          />
        )}
      </div>

      {/* Controles de Paginação */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalContas}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        loading={loading}
        itemName="contas bancárias"
      />

      {/* Modal de cadastro/edição */}
      <ClienteContaBancariaModal
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
        bancos={bancos}
        submitError={submitError}
      />

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setContaToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          contaToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar esta conta bancária?
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
    </div>
  );
};

export default ClienteContasBancariasList;
