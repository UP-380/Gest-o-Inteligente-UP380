import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
 * Componente de lista de vigências do colaborador
 */
const ColaboradorVigenciasList = ({ colaboradorId, colaboradorNome }) => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [vigencias, setVigencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVigencias, setTotalVigencias] = useState(0);
  const [tiposContrato, setTiposContrato] = useState([]);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vigenciaToDelete, setVigenciaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar tipos de contrato
  const loadTiposContrato = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tipos-contrato-membro?limit=1000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTiposContrato(result.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de contrato:', error);
    }
  }, []);

  // Formatar valor monetário
  const formatarMoeda = (valor) => {
    if (!valor && valor !== 0) return '-';
    const num = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d,.-]/g, '').replace(',', '.')) : valor;
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  };

  // Formatar data
  const formatarData = (data) => {
    if (!data) return '-';
    try {
      const date = new Date(data);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  // Carregar vigências
  const loadVigencias = useCallback(async () => {
    if (!colaboradorId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        membro_id: colaboradorId.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia?${params}`, {
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
        setVigencias(result.data || []);
        setTotalVigencias(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar vigências');
      }
    } catch (error) {
      console.error('Erro ao carregar vigências:', error);
      showToast('error', error.message || 'Erro ao carregar vigências. Tente novamente.');
      setVigencias([]);
    } finally {
      setLoading(false);
    }
  }, [colaboradorId, currentPage, itemsPerPage, searchTerm, showToast]);

  // Deletar vigência
  const handleDelete = useCallback(async () => {
    if (!vigenciaToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/${vigenciaToDelete.id}`, {
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
        showToast('success', 'Vigência deletada com sucesso!');
        setShowDeleteModal(false);
        setVigenciaToDelete(null);
        await loadVigencias();
      } else {
        throw new Error(result.error || 'Erro ao deletar vigência');
      }
    } catch (error) {
      console.error('Erro ao deletar vigência:', error);
      showToast('error', error.message || 'Erro ao deletar vigência. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [vigenciaToDelete, loadVigencias, showToast]);

  // Navegar para nova vigência
  const handleNewVigencia = () => {
    navigate(`/cadastro/vigencia?membroId=${colaboradorId}`);
  };

  // Navegar para editar vigência
  const handleEdit = (vigencia) => {
    navigate(`/cadastro/vigencia?id=${vigencia.id}`);
  };

  // Confirmar exclusão
  const confirmDelete = (vigencia) => {
    setVigenciaToDelete(vigencia);
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
    loadTiposContrato();
  }, [loadTiposContrato]);

  useEffect(() => {
    loadVigencias();
  }, [loadVigencias]);

  // Obter nome do tipo de contrato
  const getTipoContratoNome = (tipoContratoId) => {
    if (!tipoContratoId) return '-';
    const tipo = tiposContrato.find(t => t.id === tipoContratoId);
    return tipo ? tipo.nome : '-';
  };

  // Definir colunas da tabela
  const tableColumns = [
    { 
      key: 'dt_vigencia', 
      label: 'Data Vigência',
      render: (item) => formatarData(item.dt_vigencia)
    },
    { 
      key: 'salariobase', 
      label: 'Salário Base',
      render: (item) => formatarMoeda(item.salariobase)
    },
    { 
      key: 'horascontratadasdia', 
      label: 'Horas/Dia',
      render: (item) => item.horascontratadasdia || '-'
    },
    { 
      key: 'tipo_contrato', 
      label: 'Tipo Contrato',
      render: (item) => getTipoContratoNome(item.tipo_contrato)
    },
    { 
      key: 'custo_hora', 
      label: 'Custo Hora',
      render: (item) => formatarMoeda(item.custo_hora)
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (vigencia) => {
    return (
      <>
        <EditButton
          onClick={() => handleEdit(vigencia)}
          title="Editar"
        />
        <DeleteButton
          onClick={() => confirmDelete(vigencia)}
          title="Deletar"
        />
      </>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
            Vigências
          </h3>
          {colaboradorNome && (
            <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
              Colaborador: {colaboradorNome}
            </p>
          )}
        </div>
        <ButtonPrimary
          onClick={handleNewVigencia}
          icon="fas fa-plus"
        >
          Nova Vigência
        </ButtonPrimary>
      </div>

      {/* Filtro de busca */}
      <div style={{ marginBottom: '20px' }}>
        <SearchInput
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Buscar por data ou tipo de contrato..."
        />
      </div>

      {/* Lista de vigências */}
      <div style={{ marginBottom: '20px' }}>
        {loading ? (
          <LoadingState message="Carregando vigências..." />
        ) : (
          <DataTable
            columns={tableColumns}
            data={vigencias}
            renderActions={renderTableActions}
            emptyMessage="Nenhuma vigência encontrada"
            emptyIcon="fa-calendar-alt"
          />
        )}
      </div>

      {/* Controles de Paginação */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalVigencias}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        loading={loading}
        itemName="vigências"
      />

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setVigenciaToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          vigenciaToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar esta vigência?
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

export default ColaboradorVigenciasList;

