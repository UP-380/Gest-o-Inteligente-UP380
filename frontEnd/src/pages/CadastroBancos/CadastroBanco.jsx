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
import BankLogo from '../../components/bancos/BankLogo';
import './CadastroBanco.css';

const API_BASE_URL = '/api';

const CadastroBanco = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [bancos, setBancos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBancos, setTotalBancos] = useState(0);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bancoToDelete, setBancoToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar bancos
  const loadBancos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/bancos?${params}`, {
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

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        if (contentType.includes('text/html')) {
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/bancos existe no backend. Status: ${response.status}`);
        }
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setBancos(result.data || []);
        setTotalBancos(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar bancos');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar bancos:', error);
      const errorMessage = error.message || 'Erro ao carregar bancos. Tente novamente.';
      showToast('error', errorMessage);
      setBancos([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);


  // Deletar banco
  const handleDelete = useCallback(async () => {
    if (!bancoToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/bancos/${bancoToDelete.id}`, {
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
        showToast('success', 'Banco deletado com sucesso!');
        setShowDeleteModal(false);
        setBancoToDelete(null);
        await loadBancos();
      } else {
        throw new Error(result.error || 'Erro ao deletar banco');
      }
    } catch (error) {
      console.error('Erro ao deletar banco:', error);
      showToast('error', error.message || 'Erro ao deletar banco. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [bancoToDelete, loadBancos, showToast]);

  // Navegar para novo banco
  const handleNewBanco = () => {
    navigate('/cadastro/banco', { state: { from: '/cadastro/bancos' } });
  };

  // Navegar para edição
  const handleEdit = (banco) => {
    navigate(`/cadastro/banco?id=${banco.id}`, { state: { from: '/cadastro/bancos' } });
  };

  // Confirmar exclusão
  const confirmDelete = (banco) => {
    setBancoToDelete(banco);
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

  // Definir colunas da tabela
  const tableColumns = [
    { 
      key: 'nome', 
      label: 'Nome',
      render: (banco) => (
        <div className="bank-logo-table">
          <BankLogo 
            codigo={banco.codigo} 
            nome={banco.nome} 
            size={40}
          />
          <span>{banco.nome || '-'}</span>
        </div>
      )
    },
    { key: 'codigo', label: 'Código' }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (banco) => (
    <>
      <EditButton
        onClick={() => handleEdit(banco)}
        title="Editar"
      />
      <DeleteButton
        onClick={() => confirmDelete(banco)}
        title="Deletar"
      />
    </>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="bancos-listing-section">
              <div className="cadastro-listing-page-header">
                <div className="cadastro-listing-header-content">
                  <div className="cadastro-listing-header-left">
                    <div className="cadastro-listing-header-icon">
                      <i className="fas fa-university" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-listing-page-title">Cadastro de Banco</h1>
                      <p className="cadastro-listing-page-subtitle">
                        Gerencie os bancos cadastrados no sistema
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
                  placeholder="Buscar banco por nome ou código..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewBanco}
                    icon="fas fa-plus"
                  >
                    Novo Banco
                  </ButtonPrimary>
                </div>
              </div>

              {/* Lista de bancos */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando bancos..." />
                ) : (
                  <DataTable
                    columns={tableColumns}
                    data={bancos}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhum banco encontrado"
                    emptyIcon="fa-university"
                  />
                )}
              </div>

              {/* Controles de Paginação */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalBancos}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                loading={loading}
                itemName="bancos"
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
          setBancoToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          bancoToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar o banco{' '}
                <strong>{bancoToDelete.nome}</strong>?
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

export default CadastroBanco;
