import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import DataTable from '../../components/common/DataTable';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterColaborador from '../../components/filters/FilterColaborador';
import LoadingState from '../../components/common/LoadingState';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import './ListaVigencias.css';

const API_BASE_URL = '/api';

const ListaVigencias = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();

  // Obter colaboradorId da query string (se vier da página de colaborador)
  const colaboradorIdParam = searchParams.get('colaboradorId');

  // Estados principais
  const [vigencias, setVigencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroColaboradorId, setFiltroColaboradorId] = useState(colaboradorIdParam ? [colaboradorIdParam] : null);
  const [colaboradoresParaFiltro, setColaboradoresParaFiltro] = useState([]);
  const [tiposContrato, setTiposContrato] = useState([]);

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVigencias, setTotalVigencias] = useState(0);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vigenciaToDelete, setVigenciaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar colaboradores para o filtro
  const loadColaboradoresParaFiltro = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/membros-id-nome`, {
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
      if (result.success && Array.isArray(result.data)) {
        setColaboradoresParaFiltro(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores para filtro:', error);
      setColaboradoresParaFiltro([]);
    }
  }, []);

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

  // Obter nome do tipo de contrato
  const getNomeTipoContrato = (tipoContratoId) => {
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

  // Obter nome do colaborador
  const getNomeColaborador = (membroId) => {
    const colaborador = colaboradoresParaFiltro.find(c => c.id === membroId);
    return colaborador ? colaborador.nome : '-';
  };

  // Carregar vigências
  const loadVigencias = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      // Se há filtro de colaborador, adicionar ao parâmetro
      if (filtroColaboradorId && Array.isArray(filtroColaboradorId) && filtroColaboradorId.length > 0) {
        filtroColaboradorId.forEach(id => {
          params.append('membro_id', id.toString());
        });
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

      if (result.success && result.data) {
        const vigenciasData = Array.isArray(result.data) ? result.data : (result.data.vigencias || []);
        setVigencias(vigenciasData);
        setTotalVigencias(result.data.total || result.total || vigenciasData.length);
        setTotalPages(result.data.totalPages || result.totalPages || Math.ceil((result.data.total || result.total || vigenciasData.length) / itemsPerPage));
      } else {
        setVigencias([]);
        setTotalVigencias(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Erro ao carregar vigências:', error);
      showToast('error', 'Erro ao carregar vigências. Tente novamente.');
      setVigencias([]);
      setTotalVigencias(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filtroColaboradorId, showToast]);

  // Excluir vigência
  const handleDelete = async () => {
    if (!vigenciaToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/${vigenciaToDelete.id}`, {
        method: 'DELETE',
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

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Vigência excluída com sucesso!');
        setShowDeleteModal(false);
        setVigenciaToDelete(null);
        loadVigencias();
      } else {
        showToast('error', result.error || 'Erro ao excluir vigência.');
      }
    } catch (error) {
      console.error('Erro ao excluir vigência:', error);
      showToast('error', 'Erro ao excluir vigência. Tente novamente.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Confirmar exclusão
  const confirmDelete = (vigencia) => {
    setVigenciaToDelete(vigencia);
    setShowDeleteModal(true);
  };

  // Limpar filtros
  const limparFiltros = () => {
    setFiltroColaboradorId(null);
    setCurrentPage(1);
  };

  // Efeitos
  useEffect(() => {
    loadColaboradoresParaFiltro();
    loadTiposContrato();
  }, [loadColaboradoresParaFiltro, loadTiposContrato]);

  useEffect(() => {
    loadVigencias();
  }, [loadVigencias]);

  // Calcular itens exibidos
  const startItem = totalVigencias === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalVigencias);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            {/* Header */}
            <div className="lista-vigencias-header">
              <div>
                <h1 className="lista-vigencias-title">Vigências</h1>
                <p className="lista-vigencias-subtitle">Gerencie as vigências dos colaboradores</p>
              </div>
              <div className="lista-vigencias-actions">
                <button
                  className="btn-secondary"
                  onClick={() => navigate(-1)}
                >
                  <i className="fas fa-arrow-left"></i>
                  Voltar
                </button>
                <ButtonPrimary
                  onClick={() => navigate('/cadastro/vigencia')}
                  icon="fas fa-plus"
                >
                  Nova Vigência
                </ButtonPrimary>
              </div>
            </div>

            {/* Filtros */}
            <FiltersCard
              onClear={limparFiltros}
              showActions={true}
            >
              <div className="filter-group">
                <FilterColaborador
                  value={filtroColaboradorId}
                  onChange={(value) => {
                    setFiltroColaboradorId(value);
                    setCurrentPage(1);
                  }}
                  options={colaboradoresParaFiltro}
                  disabled={false}
                />
              </div>
            </FiltersCard>

            {/* Lista de vigências */}
            <div className="listing-table-container view-transition view-enter">
              {loading ? (
                <LoadingState message="Carregando vigências..." />
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'colaborador',
                      label: 'Colaborador',
                      render: (vigencia) => getNomeColaborador(vigencia.membro_id)
                    },
                    {
                      key: 'data',
                      label: 'Data de Vigência',
                      render: (vigencia) => formatarData(vigencia.dt_vigencia)
                    },
                    {
                      key: 'tipo_contrato',
                      label: 'Tipo de Contrato',
                      render: (vigencia) => getNomeTipoContrato(vigencia.tipo_contrato)
                    },
                    {
                      key: 'horas_dia',
                      label: 'Horas/Dia',
                      render: (vigencia) => vigencia.horascontratadasdia || '-'
                    },
                    {
                      key: 'salario_base',
                      label: 'Salário Base',
                      render: (vigencia) => formatarMoeda(vigencia.salariobase)
                    },
                    {
                      key: 'custo_total_mensal',
                      label: 'Custo Total Mensal',
                      render: (vigencia) => {
                        // Calcular custo total mensal se não existir no banco
                        if (vigencia.custo_total_mensal) {
                          return formatarMoeda(vigencia.custo_total_mensal);
                        }
                        // Se não existir, calcular baseado nos valores disponíveis
                        const salarioBase = parseFloat(vigencia.salariobase) || 0;
                        const ferias = parseFloat(vigencia.ferias) || 0;
                        const tercoFerias = parseFloat(vigencia.um_terco_ferias) || 0;
                        const decimoTerceiro = parseFloat(vigencia.decimoterceiro) || 0;
                        const fgts = parseFloat(vigencia.fgts) || 0;
                        const valeTransporte = parseFloat(vigencia.valetransporte) || 0;
                        const valeRefeicao = parseFloat(vigencia.vale_refeicao) || 0;
                        const ajudaCusto = parseFloat(vigencia.ajudacusto) || 0;
                        
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
                      render: (vigencia) => {
                        // Calcular custo diário total se não existir no banco
                        if (vigencia.custo_diario_total) {
                          return formatarMoeda(vigencia.custo_diario_total);
                        }
                        // Se não existir, calcular baseado nos valores disponíveis
                        const salarioBase = parseFloat(vigencia.salariobase) || 0;
                        const ferias = parseFloat(vigencia.ferias) || 0;
                        const tercoFerias = parseFloat(vigencia.um_terco_ferias) || 0;
                        const decimoTerceiro = parseFloat(vigencia.decimoterceiro) || 0;
                        const fgts = parseFloat(vigencia.fgts) || 0;
                        const valeTransporte = parseFloat(vigencia.valetransporte) || 0;
                        const valeRefeicao = parseFloat(vigencia.vale_refeicao) || 0;
                        const ajudaCusto = parseFloat(vigencia.ajudacusto) || 0;
                        
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
                  ]}
                  data={vigencias}
                  renderActions={(vigencia) => (
                    <>
                      <EditButton
                        onClick={() => navigate(`/cadastro/vigencia?id=${vigencia.id}`)}
                        title="Editar"
                        disabled={false}
                      />
                      <DeleteButton
                        onClick={() => confirmDelete(vigencia)}
                        title="Excluir"
                        disabled={false}
                      />
                    </>
                  )}
                  emptyMessage="Nenhuma vigência encontrada"
                  emptyIcon="fa-calendar-alt"
                />
              )}
              {!loading && vigencias.length > 0 && (
                <>
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
                    Mostrando {startItem} a {endItem} de {totalVigencias} vigências
                  </div>
                </>
              )}
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setVigenciaToDelete(null);
        }}
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        title="Excluir Vigência"
        message={
          <>
            <p>Tem certeza que deseja excluir esta vigência?</p>
            {vigenciaToDelete && (
              <p style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
                <strong>Colaborador:</strong> {getNomeColaborador(vigenciaToDelete.membro_id)}<br />
                <strong>Data:</strong> {formatarData(vigenciaToDelete.dt_vigencia)}
              </p>
            )}
            <p style={{ marginTop: '12px', color: '#ef4444', fontWeight: '500' }}>
              Esta ação não pode ser desfeita.
            </p>
          </>
        }
        confirmText="Excluir"
        confirmButtonClass="btn-danger"
      />
    </Layout>
  );
};

export default ListaVigencias;

