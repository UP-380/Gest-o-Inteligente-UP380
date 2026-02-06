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
import './CadastroAdquirente.css';

const API_BASE_URL = '/api';

const CadastroAdquirente = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [adquirentes, setAdquirentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAdquirentes, setTotalAdquirentes] = useState(0);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adquirenteToDelete, setAdquirenteToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar adquirentes
  const loadAdquirentes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/adquirentes?${params}`, {
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
          throw new Error(`Servidor retornou HTML em vez de JSON. Verifique se a rota /api/adquirentes existe no backend. Status: ${response.status}`);
        }
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
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
      const errorMessage = error.message || 'Erro ao carregar adquirentes. Tente novamente.';
      showToast('error', errorMessage);
      setAdquirentes([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);


  // Deletar adquirente
  const handleDelete = useCallback(async () => {
    if (!adquirenteToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/adquirentes/${adquirenteToDelete.id}`, {
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
        showToast('success', 'Adquirente deletado com sucesso!');
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

  // Navegar para novo adquirente
  const handleNewAdquirente = () => {
    navigate('/cadastro/adquirente', { state: { from: '/cadastro/adquirentes' } });
  };

  // Navegar para edição
  const handleEdit = (adquirente) => {
    navigate(`/cadastro/adquirente?id=${adquirente.id}`, { state: { from: '/cadastro/adquirentes' } });
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
    loadAdquirentes();
  }, [loadAdquirentes]);

  // Definir colunas da tabela
  const tableColumns = [
    { key: 'nome', label: 'Nome' }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (adquirente) => (
    <>
      <EditButton
        onClick={() => handleEdit(adquirente)}
        title="Editar"
      />
      <DeleteButton
        onClick={() => confirmDelete(adquirente)}
        title="Deletar"
      />
    </>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="adquirentes-listing-section">
              <div className="cadastro-listing-page-header">
                <div className="cadastro-listing-header-content">
                  <div className="cadastro-listing-header-left">
                    <div className="cadastro-listing-header-icon">
                      <i className="fas fa-credit-card" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-listing-page-title">Cadastro de Adquirente</h1>
                      <p className="cadastro-listing-page-subtitle">
                        Gerencie os adquirentes cadastrados no sistema
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
                  placeholder="Buscar adquirente por nome..."
                />
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewAdquirente}
                    icon="fas fa-plus"
                  >
                    Novo Adquirente
                  </ButtonPrimary>
                </div>
              </div>

              {/* Lista de adquirentes */}
              <div className="listing-table-container">
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
            </div>
          </CardContainer>
        </main>
      </div>

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
                Tem certeza que deseja deletar o adquirente{' '}
                <strong>{adquirenteToDelete.nome}</strong>?
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

export default CadastroAdquirente;
