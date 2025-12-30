import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import { useToast } from '../../hooks/useToast';
import './PlanilhaHoras.css';

const PlanilhaHoras = () => {
  const { usuario } = useAuth();
  const showToast = useToast();
  
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nomesTarefas, setNomesTarefas] = useState({});
  const [nomesClientes, setNomesClientes] = useState({});

  // Formatar tempo em horas/minutos/segundos
  const formatarTempoHMS = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0s';
    
    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    
    if (horas > 0) {
      return `${horas}h ${minutos}min ${segundos}s`;
    } else if (minutos > 0) {
      return `${minutos}min ${segundos}s`;
    } else {
      return `${segundos}s`;
    }
  };

  // Formatar data para exibição
  const formatarData = (dataStr) => {
    if (!dataStr) return '';
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  };

  // Buscar nomes das tarefas
  const buscarNomesTarefas = async (tarefasIds) => {
    if (tarefasIds.length === 0) return {};

    try {
      const response = await fetch(
        `/api/tarefas-por-ids?ids=${tarefasIds.join(',')}`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data;
        }
      }
      return {};
    } catch (error) {
      console.error('Erro ao buscar nomes das tarefas:', error);
      return {};
    }
  };

  // Buscar nomes dos clientes
  const buscarNomesClientes = async (clientesIds) => {
    if (clientesIds.length === 0) return {};

    const nomes = {};
    
    try {
      const clientesPromises = clientesIds.map(async (clienteId) => {
        try {
          const idStr = String(clienteId).trim();
          const response = await fetch(`/api/base-conhecimento/cliente/${idStr}`, {
            credentials: 'include',
            headers: { 
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.cliente) {
              const cliente = result.data.cliente;
              const nome = cliente.nome || 
                           cliente.nome_amigavel || 
                           cliente.amigavel ||
                           cliente.nome_fantasia || 
                           cliente.fantasia ||
                           cliente.razao_social || 
                           cliente.razao ||
                           null;
              if (nome) {
                return { id: clienteId, nome: nome };
              }
            }
          }
        } catch (error) {
          console.warn(`Erro ao buscar cliente ${clienteId}:`, error);
        }
        return null;
      });
      
      const clientesData = await Promise.all(clientesPromises);
      clientesData.forEach(cliente => {
        if (cliente && cliente.nome) {
          nomes[cliente.id] = cliente.nome;
        }
      });
    } catch (error) {
      console.error('Erro ao buscar nomes dos clientes:', error);
    }

    return nomes;
  };

  // Buscar histórico de tempo
  const buscarHistorico = useCallback(async () => {
    if (!usuario || !usuario.id) return;
    if (!dataInicio || !dataFim) {
      setRegistros([]);
      return;
    }

    setLoading(true);
    try {
      // Usar endpoint genérico que aceita filtros de data
      const response = await fetch(
        `/api/registro-tempo?usuario_id=${usuario.id}&data_inicio=${dataInicio}&data_fim=${dataFim}&ativo=false&limit=10000`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Filtrar apenas registros finalizados com data_fim
          const registrosFiltrados = result.data.filter(reg => {
            return reg.data_inicio && reg.data_fim;
          });

          setRegistros(registrosFiltrados);

          // Buscar nomes das tarefas
          const tarefasIds = [...new Set(registrosFiltrados.map(r => r.tarefa_id).filter(Boolean))];
          if (tarefasIds.length > 0) {
            const nomesTarefasData = await buscarNomesTarefas(tarefasIds);
            setNomesTarefas(nomesTarefasData);
          }

          // Buscar nomes dos clientes
          const clientesIds = [...new Set(registrosFiltrados.map(r => r.cliente_id).filter(Boolean))];
          if (clientesIds.length > 0) {
            const nomesClientesData = await buscarNomesClientes(clientesIds);
            setNomesClientes(nomesClientesData);
          }
        } else {
          setRegistros([]);
        }
      } else if (response.status === 401) {
        window.location.href = '/login';
      } else {
        showToast('error', 'Erro ao buscar histórico de tempo');
        setRegistros([]);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      showToast('error', 'Erro ao buscar histórico de tempo');
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [usuario, dataInicio, dataFim, showToast]);

  // Buscar quando período mudar
  useEffect(() => {
    if (dataInicio && dataFim) {
      buscarHistorico();
    }
  }, [dataInicio, dataFim, buscarHistorico]);

  // Gerar array de datas do período
  const gerarDatasPeriodo = () => {
    if (!dataInicio || !dataFim) return [];

    const datas = [];
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    
    const dataAtual = new Date(inicio);
    while (dataAtual <= fim) {
      datas.push(new Date(dataAtual));
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    return datas;
  };

  // Agrupar registros por cliente/tarefa e por data
  const agruparRegistros = () => {
    const grupos = {};
    const datas = gerarDatasPeriodo();

    registros.forEach(registro => {
      const clienteId = registro.cliente_id || 'sem-cliente';
      const tarefaId = registro.tarefa_id || 'sem-tarefa';
      const chave = `${clienteId}-${tarefaId}`;

      if (!grupos[chave]) {
        grupos[chave] = {
          clienteId,
          tarefaId,
          dias: {}
        };
      }

      // Determinar em quais dias o registro se sobrepõe
      const inicioRegistro = new Date(registro.data_inicio);
      const fimRegistro = new Date(registro.data_fim);
      const tempoTotal = registro.tempo_realizado || (fimRegistro.getTime() - inicioRegistro.getTime());

      datas.forEach(data => {
        const inicioDia = new Date(data);
        inicioDia.setHours(0, 0, 0, 0);
        const fimDia = new Date(data);
        fimDia.setHours(23, 59, 59, 999);

        // Verificar se o registro se sobrepõe com este dia
        if (inicioRegistro <= fimDia && fimRegistro >= inicioDia) {
          const chaveData = data.toISOString().split('T')[0];
          
          if (!grupos[chave].dias[chaveData]) {
            grupos[chave].dias[chaveData] = 0;
          }

          // Calcular tempo que se sobrepõe com este dia
          const inicioSobreposicao = inicioRegistro > inicioDia ? inicioRegistro : inicioDia;
          const fimSobreposicao = fimRegistro < fimDia ? fimRegistro : fimDia;
          const tempoSobreposicao = fimSobreposicao.getTime() - inicioSobreposicao.getTime();
          
          grupos[chave].dias[chaveData] += tempoSobreposicao;
        }
      });
    });

    return grupos;
  };

  // Calcular totais por dia
  const calcularTotaisPorDia = () => {
    const grupos = agruparRegistros();
    const datas = gerarDatasPeriodo();
    const totais = {};

    datas.forEach(data => {
      const chaveData = data.toISOString().split('T')[0];
      totais[chaveData] = 0;

      Object.values(grupos).forEach(grupo => {
        if (grupo.dias[chaveData]) {
          totais[chaveData] += grupo.dias[chaveData];
        }
      });
    });

    return totais;
  };

  const grupos = agruparRegistros();
  const datas = gerarDatasPeriodo();
  const totaisPorDia = calcularTotaisPorDia();

  // Calcular total geral
  const totalGeral = Object.values(totaisPorDia).reduce((acc, total) => acc + total, 0);

  return (
    <Layout>
      <div className="container">
        <main className="main-content planilha-horas-main">
          <div className="planilha-horas-header">
            <h1 className="planilha-horas-title">Planilha de Horas</h1>
            <p className="planilha-horas-subtitle">Visualize o histórico detalhado de tempo rastreado</p>
          </div>

          <div className="planilha-horas-filters">
            <div className="planilha-horas-filter-row">
              <div className="planilha-horas-filter-item">
                <label className="planilha-horas-filter-label">Período</label>
                <FilterPeriodo
                  dataInicio={dataInicio}
                  dataFim={dataFim}
                  onInicioChange={(e) => setDataInicio(e.target.value)}
                  onFimChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="planilha-horas-loading">
              <div className="spinner"></div>
              <p>Carregando dados...</p>
            </div>
          ) : !dataInicio || !dataFim ? (
            <div className="planilha-horas-empty">
              <i className="fas fa-calendar-alt"></i>
              <p>Selecione um período para visualizar a planilha</p>
            </div>
          ) : Object.keys(grupos).length === 0 ? (
            <div className="planilha-horas-empty">
              <i className="fas fa-clock"></i>
              <p>Nenhum registro de tempo encontrado no período selecionado</p>
            </div>
          ) : (
            <div className="planilha-horas-container">
              <div className="planilha-horas-table-wrapper">
                <table className="planilha-horas-table">
                  <thead>
                    <tr>
                      <th className="planilha-horas-th planilha-horas-th-cliente">Cliente</th>
                      <th className="planilha-horas-th planilha-horas-th-tarefa">Tarefa</th>
                      {datas.map((data, index) => (
                        <th key={index} className="planilha-horas-th planilha-horas-th-data">
                          {formatarData(data.toISOString().split('T')[0])}
                        </th>
                      ))}
                      <th className="planilha-horas-th planilha-horas-th-total">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(grupos).map((grupo, index) => {
                      const clienteNome = grupo.clienteId !== 'sem-cliente' 
                        ? (nomesClientes[grupo.clienteId] || `Cliente #${grupo.clienteId}`)
                        : 'Sem Cliente';
                      const tarefaNome = grupo.tarefaId !== 'sem-tarefa'
                        ? (nomesTarefas[grupo.tarefaId] || `Tarefa #${grupo.tarefaId}`)
                        : 'Sem Tarefa';
                      
                      const totalLinha = Object.values(grupo.dias).reduce((acc, tempo) => acc + tempo, 0);

                      return (
                        <tr key={index} className="planilha-horas-tr">
                          <td className="planilha-horas-td planilha-horas-td-cliente">{clienteNome}</td>
                          <td className="planilha-horas-td planilha-horas-td-tarefa">{tarefaNome}</td>
                          {datas.map((data, dataIndex) => {
                            const chaveData = data.toISOString().split('T')[0];
                            const tempo = grupo.dias[chaveData] || 0;
                            return (
                              <td key={dataIndex} className="planilha-horas-td planilha-horas-td-tempo">
                                {tempo > 0 ? formatarTempoHMS(tempo) : '—'}
                              </td>
                            );
                          })}
                          <td className="planilha-horas-td planilha-horas-td-total">
                            {formatarTempoHMS(totalLinha)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="planilha-horas-tr planilha-horas-tr-total">
                      <td className="planilha-horas-td planilha-horas-td-total-label" colSpan="2">
                        <strong>Total Geral</strong>
                      </td>
                      {datas.map((data, index) => {
                        const chaveData = data.toISOString().split('T')[0];
                        const total = totaisPorDia[chaveData] || 0;
                        return (
                          <td key={index} className="planilha-horas-td planilha-horas-td-total">
                            <strong>{formatarTempoHMS(total)}</strong>
                          </td>
                        );
                      })}
                      <td className="planilha-horas-td planilha-horas-td-total">
                        <strong>{formatarTempoHMS(totalGeral)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
};

export default PlanilhaHoras;

