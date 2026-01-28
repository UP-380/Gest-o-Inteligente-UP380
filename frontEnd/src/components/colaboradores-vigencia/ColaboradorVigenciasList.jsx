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
      const response = await fetch(`${API_BASE_URL}/tipo-contrato-membro?limit=1000`, {
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
    if (!tipoContratoId && tipoContratoId !== 0) return '-';
    
    // Se tipos de contrato ainda não foram carregados, retornar '-'
    if (!tiposContrato || tiposContrato.length === 0) return '-';
    
    // Converter para número se necessário (pode vir como string do backend)
    const idNum = typeof tipoContratoId === 'string' ? parseInt(tipoContratoId, 10) : tipoContratoId;
    if (isNaN(idNum)) {
      console.warn('Tipo de contrato inválido:', tipoContratoId);
      return '-';
    }
    
    const tipo = tiposContrato.find(t => {
      // Comparar tanto como número quanto como string para garantir compatibilidade
      const tipoId = typeof t.id === 'string' ? parseInt(t.id, 10) : t.id;
      return tipoId === idNum || t.id === idNum || String(t.id) === String(idNum);
    });
    
    if (!tipo) {
      console.warn('Tipo de contrato não encontrado para ID:', tipoContratoId, 'Tipos disponíveis:', tiposContrato.map(t => ({ id: t.id, nome: t.nome })));
    }
    
    return tipo ? tipo.nome : '-';
  };

  // Definir colunas da tabela
  const tableColumns = [
    { 
      key: 'dt_vigencia', 
      label: 'Data de Vigência',
      render: (item) => formatarData(item.dt_vigencia)
    },
    { 
      key: 'tipo_contrato', 
      label: 'Tipo de Contrato',
      render: (item) => getTipoContratoNome(item.tipo_contrato)
    },
    { 
      key: 'horascontratadasdia', 
      label: 'Horas/Dia',
      render: (item) => item.horascontratadasdia || '-'
    },
    { 
      key: 'salariobase', 
      label: 'Salário Base',
      render: (item) => formatarMoeda(item.salariobase)
    },
    { 
      key: 'custo_total_mensal', 
      label: 'Custo Total Mensal',
      render: (item) => {
        // Calcular custo total mensal se não existir no banco
        if (item.custo_total_mensal) {
          return formatarMoeda(item.custo_total_mensal);
        }
        // Se não existir, calcular baseado nos valores disponíveis
        const salarioBase = parseFloat(item.salariobase) || 0;
        const ferias = parseFloat(item.ferias) || 0;
        const tercoFerias = parseFloat(item.um_terco_ferias) || 0;
        const decimoTerceiro = parseFloat(item.decimoterceiro) || 0;
        const fgts = parseFloat(item.fgts) || 0;
        const valeTransporte = parseFloat(item.valetransporte) || 0;
        const valeRefeicao = parseFloat(item.vale_refeicao) || 0;
        const ajudaCusto = parseFloat(item.ajudacusto) || 0;
        
        // Assumir 22 dias úteis como padrão
        const diasUteis = 22;
        
        // Converter valores diários para mensais
        const feriasMensal = ferias * diasUteis;
        const tercoFeriasMensal = tercoFerias * diasUteis;
        const decimoTerceiroMensal = decimoTerceiro * diasUteis;
        const fgtsMensal = fgts * diasUteis;
        const valeTransporteMensal = valeTransporte * diasUteis;
        const valeRefeicaoMensal = valeRefeicao * diasUteis;
        const ajudaCustoMensal = ajudaCusto * diasUteis;
        
        const custoTotal = salarioBase + feriasMensal + tercoFeriasMensal + 
                          decimoTerceiroMensal + fgtsMensal + valeTransporteMensal + 
                          valeRefeicaoMensal + ajudaCustoMensal;
        
        return formatarMoeda(custoTotal);
      }
    },
    { 
      key: 'custo_diario_total', 
      label: 'Custo Diário Total',
      render: (item) => {
        // Calcular custo diário total se não existir no banco
        if (item.custo_diario_total) {
          return formatarMoeda(item.custo_diario_total);
        }
        // Se não existir, calcular baseado nos valores disponíveis
        const salarioBase = parseFloat(item.salariobase) || 0;
        const ferias = parseFloat(item.ferias) || 0;
        const tercoFerias = parseFloat(item.um_terco_ferias) || 0;
        const decimoTerceiro = parseFloat(item.decimoterceiro) || 0;
        const fgts = parseFloat(item.fgts) || 0;
        const valeTransporte = parseFloat(item.valetransporte) || 0;
        const valeRefeicao = parseFloat(item.vale_refeicao) || 0;
        const ajudaCusto = parseFloat(item.ajudacusto) || 0;
        
        // Assumir 22 dias úteis como padrão
        const diasUteis = 22;
        
        // Calcular salário base diário
        const salarioBaseDiario = diasUteis > 0 ? salarioBase / diasUteis : 0;
        
        // Somar todos os valores diários
        const custoDiarioTotal = salarioBaseDiario + ferias + tercoFerias + 
                                decimoTerceiro + fgts + valeTransporte + 
                                valeRefeicao + ajudaCusto;
        
        return formatarMoeda(custoDiarioTotal);
      }
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

