import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import FilterDate from '../../components/filters/FilterDate';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import { useToast } from '../../hooks/useToast';
import './PlanilhaHoras.css';

const PlanilhaHoras = () => {
  const { usuario } = useAuth();
  const showToast = useToast();

  // Calcular data de início e fim da semana atual (Segunda a Domingo)
  const getSemanaAtual = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diaSemana = hoje.getDay(); // 0 = Dom, 1 = Seg, ...
    const dia = hoje.getDate();

    // Distância para a segunda-feira
    const distSegunda = diaSemana === 0 ? 6 : diaSemana - 1;

    const inicio = new Date(hoje);
    inicio.setDate(dia - distSegunda);

    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);

    const formatar = (d) => {
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    };

    return { inicio: formatar(inicio), fim: formatar(fim) };
  };

  const { inicio: dataInicioInicial, fim: dataFimInicial } = getSemanaAtual();

  const [dataInicio, setDataInicio] = useState(dataInicioInicial);
  const [dataFim, setDataFim] = useState(dataFimInicial);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nomesTarefas, setNomesTarefas] = useState({});
  const [nomesClientes, setNomesClientes] = useState({});

  // Estados para edição/exclusão
  const [modalRegistroAberto, setModalRegistroAberto] = useState(false);
  const [celulaSelecionada, setCelulaSelecionada] = useState(null);
  const [registroEditandoId, setRegistroEditandoId] = useState(null);
  const [registroDeletandoId, setRegistroDeletandoId] = useState(null);
  const [formDataPorRegistro, setFormDataPorRegistro] = useState({});
  const [justificativaDelecaoPorRegistro, setJustificativaDelecaoPorRegistro] = useState({});
  const [salvando, setSalvando] = useState(false);

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

  // Converter HMS para milissegundos
  const hmsParaMilissegundos = (hms) => {
    if (!hms) return 0;
    const partes = hms.split(':');
    let h = 0, m = 0, s = 0;

    if (partes.length === 3) {
      h = parseInt(partes[0]) || 0;
      m = parseInt(partes[1]) || 0;
      s = parseInt(partes[2]) || 0;
    } else if (partes.length === 2) {
      m = parseInt(partes[0]) || 0;
      s = parseInt(partes[1]) || 0;
    } else {
      s = parseInt(partes[0]) || 0;
    }

    return (h * 3600 + m * 60 + s) * 1000;
  };

  // Converter milissegundos para HH:mm:ss
  const milissegundosParaHMS = (ms) => {
    if (!ms) return '00:00:00';
    const totalSegundos = Math.floor(ms / 1000);
    const h = Math.floor(totalSegundos / 3600);
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

  // Handlers para edição/exclusão
  const handleCellClick = (grupo, dataChave) => {
    const registrosDia = grupo.registrosPorDia[dataChave] || [];
    if (registrosDia.length === 0) return;

    setCelulaSelecionada({
      clienteNome: grupo.clienteId !== 'sem-cliente' ? (nomesClientes[grupo.clienteId] || 'Cliente') : 'Sem Cliente',
      tarefaNome: grupo.tarefaId !== 'sem-tarefa' ? (nomesTarefas[grupo.tarefaId] || 'Tarefa') : 'Sem Tarefa',
      data: dataChave,
      registros: registrosDia
    });
    setModalRegistroAberto(true);
  };

  const handleEditar = (e, registro) => {
    if (e) e.stopPropagation();

    if (registroEditandoId === registro.id) {
      setRegistroEditandoId(null);
      return;
    }

    const dataInicio = new Date(registro.data_inicio);
    const dataFim = registro.data_fim ? new Date(registro.data_fim) : new Date();

    const formatarDataISO = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    setRegistroEditandoId(registro.id);
    setFormDataPorRegistro({
      ...formDataPorRegistro,
      [registro.id]: {
        data_inicio: formatarDataISO(dataInicio),
        hora_inicio: dataInicio.getHours(),
        minuto_inicio: dataInicio.getMinutes(),
        data_fim: formatarDataISO(dataFim),
        hora_fim: dataFim.getHours(),
        minuto_fim: dataFim.getMinutes(),
        justificativa: ''
      }
    });

    if (registroDeletandoId === registro.id) {
      setRegistroDeletandoId(null);
    }
  };

  const handleDeletar = (e, registro) => {
    if (e) e.stopPropagation();

    if (registroDeletandoId === registro.id) {
      setRegistroDeletandoId(null);
      return;
    }

    setRegistroDeletandoId(registro.id);
    setJustificativaDelecaoPorRegistro({
      ...justificativaDelecaoPorRegistro,
      [registro.id]: ''
    });

    if (registroEditandoId === registro.id) {
      setRegistroEditandoId(null);
    }
  };

  const handleSalvarEdicao = async (registro) => {
    const formData = formDataPorRegistro[registro.id];
    if (!formData) return;

    if (!formData.justificativa || formData.justificativa.trim() === '') {
      showToast('error', 'Justificativa é obrigatória para editar');
      return;
    }

    const dataInicioCompleta = new Date(`${formData.data_inicio}T${String(formData.hora_inicio).padStart(2, '0')}:${String(formData.minuto_inicio).padStart(2, '0')}:00`);
    const dataFimCompleta = new Date(`${formData.data_fim}T${String(formData.hora_fim).padStart(2, '0')}:${String(formData.minuto_fim).padStart(2, '0')}:00`);

    if (dataInicioCompleta >= dataFimCompleta) {
      showToast('error', 'Data de início deve ser anterior à data de fim');
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch(`/api/registro-tempo/${registro.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data_inicio: dataInicioCompleta.toISOString(),
          data_fim: dataFimCompleta.toISOString(),
          justificativa: formData.justificativa
        })
      });

      if (response.ok) {
        showToast('success', 'Registro atualizado com sucesso');
        setRegistroEditandoId(null);

        // Atualizar celula selecionada localmente
        const result = await response.json();
        if (result.success && result.data) {
          setCelulaSelecionada(prev => ({
            ...prev,
            registros: prev.registros.map(r => r.id === registro.id ? result.data : r)
          }));
        }

        buscarHistorico();
      } else {
        const result = await response.json();
        showToast('error', result.error || 'Erro ao atualizar');
      }
    } catch (error) {
      showToast('error', 'Erro ao salvar alteração');
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarDelecao = async (registro) => {
    const justificativa = justificativaDelecaoPorRegistro[registro.id];
    if (!justificativa || justificativa.trim() === '') {
      showToast('error', 'Justificativa é obrigatória para excluir');
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch(`/api/registro-tempo/${registro.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ justificativa })
      });

      if (response.ok) {
        showToast('success', 'Registro excluído com sucesso');
        setRegistroDeletandoId(null);

        // Atualizar celula selecionada localmente
        setCelulaSelecionada(prev => ({
          ...prev,
          registros: prev.registros.filter(r => r.id !== registro.id)
        }));

        buscarHistorico();

        // Se deletou o último registro da célula, fecha o modal
        if (celulaSelecionada && celulaSelecionada.registros.length <= 1) {
          setModalRegistroAberto(false);
        }
      } else {
        const result = await response.json();
        showToast('error', result.error || 'Erro ao excluir');
      }
    } catch (error) {
      showToast('error', 'Erro ao excluir registro');
    } finally {
      setSalvando(false);
    }
  };

  const onAtualizarFormData = (id, data) => {
    setFormDataPorRegistro(prev => ({ ...prev, [id]: data }));
  };

  const onAtualizarJustificativaDelecao = (id, val) => {
    setJustificativaDelecaoPorRegistro(prev => ({ ...prev, [id]: val }));
  };

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
          dias: {},
          registrosPorDia: {} // Armazenar os registros originais por dia
        };
      }

      const inicioRegistro = new Date(registro.data_inicio);
      const fimRegistro = new Date(registro.data_fim);

      datas.forEach(data => {
        const inicioDia = new Date(data);
        inicioDia.setHours(0, 0, 0, 0);
        const fimDia = new Date(data);
        fimDia.setHours(23, 59, 59, 999);

        if (inicioRegistro <= fimDia && fimRegistro >= inicioDia) {
          const chaveData = data.toISOString().split('T')[0];

          if (!grupos[chave].dias[chaveData]) {
            grupos[chave].dias[chaveData] = 0;
            grupos[chave].registrosPorDia[chaveData] = [];
          }

          const inicioSobreposicao = inicioRegistro > inicioDia ? inicioRegistro : inicioDia;
          const fimSobreposicao = fimRegistro < fimDia ? fimRegistro : fimDia;
          const tempoSobreposicao = fimSobreposicao.getTime() - inicioSobreposicao.getTime();

          grupos[chave].dias[chaveData] += tempoSobreposicao;

          // Adicionar o registro à lista deste dia se ele tiver tempo neste dia
          if (tempoSobreposicao > 0) {
            grupos[chave].registrosPorDia[chaveData].push(registro);
          }
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
          <div className="planilha-horas-header cadastro-listing-page-header">
            <div className="cadastro-listing-header-left">
              <div className="cadastro-listing-header-icon">
                <i className="fas fa-calendar-alt" style={{ fontSize: '32px', color: 'rgb(14, 59, 111)' }}></i>
              </div>
              <div>
                <h1 className="cadastro-listing-page-title">Planilha de Horas</h1>
                <p className="cadastro-listing-page-subtitle">Visualize o histórico detalhado de tempo rastreado</p>
              </div>
            </div>

            <div className="planilha-horas-hint">
              <i className="fas fa-info-circle"></i>
              <span>Clique nos tempos realizados para <strong>editar</strong> ou <strong>deletar</strong> um registro.</span>
            </div>
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
                        ? (nomesClientes[grupo.clienteId] || 'Cliente')
                        : 'Sem Cliente';
                      const tarefaNome = grupo.tarefaId !== 'sem-tarefa'
                        ? (nomesTarefas[grupo.tarefaId] || 'Tarefa')
                        : 'Sem Tarefa';

                      const totalLinha = Object.values(grupo.dias).reduce((acc, tempo) => acc + tempo, 0);

                      return (
                        <tr key={index} className="planilha-horas-tr">
                          <td className="planilha-horas-td planilha-horas-td-cliente">{clienteNome}</td>
                          <td className="planilha-horas-td planilha-horas-td-tarefa">{tarefaNome}</td>
                          {datas.map((data, dataIndex) => {
                            const chaveData = data.toISOString().split('T')[0];
                            const tempo = grupo.dias[chaveData] || 0;
                            const temRegistros = (grupo.registrosPorDia[chaveData] || []).length > 0;

                            return (
                              <td
                                key={dataIndex}
                                className={`planilha-horas-td planilha-horas-td-tempo ${temRegistros ? 'planilha-horas-td-editavel' : ''}`}
                                onClick={() => temRegistros && handleCellClick(grupo, chaveData)}
                                title={temRegistros ? 'Clique para ver/editar registros' : ''}
                              >
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

        {/* Modal de Detalhes/Edição */}
        {modalRegistroAberto && celulaSelecionada && (
          <div className="planilha-horas-modal-overlay" onClick={() => !salvando && setModalRegistroAberto(false)}>
            <div className="planilha-horas-modal" onClick={e => e.stopPropagation()}>
              <div className="planilha-horas-modal-header">
                <div className="planilha-horas-modal-title-group">
                  <h2 className="planilha-horas-modal-title">Registros de Tempo</h2>
                  <p className="planilha-horas-modal-subtitle">
                    {celulaSelecionada.clienteNome} • {celulaSelecionada.tarefaNome}
                    <br />
                    {new Date(celulaSelecionada.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button className="planilha-horas-modal-close" onClick={() => !salvando && setModalRegistroAberto(false)}>
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="planilha-horas-modal-body">
                <div className="planilha-horas-registros-lista">
                  {celulaSelecionada.registros.map(reg => {
                    const isEditando = registroEditandoId === reg.id;
                    const isDeletando = registroDeletandoId === reg.id;
                    const formData = formDataPorRegistro[reg.id] || {};
                    const justificativaDelecao = justificativaDelecaoPorRegistro[reg.id] || '';

                    return (
                      <div key={reg.id} className={`planilha-horas-registro-item ${isEditando ? 'editando' : ''} ${isDeletando ? 'deletando' : ''}`}>
                        <div className="planilha-horas-registro-info">
                          <div className="planilha-horas-registro-details">
                            <div className="planilha-horas-registro-time-range">
                              <i className="far fa-clock"></i>
                              {new Date(reg.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(reg.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="planilha-horas-registro-duration">
                              {formatarTempoHMS(reg.tempo_realizado)}
                            </div>
                          </div>

                          <div className="planilha-horas-registro-actions">
                            <EditButton
                              onClick={(e) => handleEditar(e, reg)}
                              disabled={reg.bloqueado || salvando}
                              title={reg.bloqueado ? 'Registro bloqueado' : 'Editar'}
                            />
                            <DeleteButton
                              onClick={(e) => handleDeletar(e, reg)}
                              disabled={reg.bloqueado || salvando}
                              title={reg.bloqueado ? 'Registro bloqueado' : 'Excluir'}
                            />
                          </div>
                        </div>

                        {isEditando && (
                          <div className="planilha-horas-edit-form">
                            <div className="timer-edit-form-group">
                              <label className="planilha-horas-modal-label">Início</label>
                              <div className="timer-edit-datetime-row">
                                <FilterDate
                                  label=""
                                  value={formData.data_inicio || ''}
                                  onChange={(e) => onAtualizarFormData(reg.id, { ...formData, data_inicio: e.target.value })}
                                />
                                <div className="timer-edit-time-wrapper">
                                  <input type="number" value={formData.hora_inicio || 0} onChange={(e) => onAtualizarFormData(reg.id, { ...formData, hora_inicio: parseInt(e.target.value) || 0 })} className="timer-edit-time-input" min="0" max="23" />
                                  <span>h</span>
                                  <input type="number" value={formData.minuto_inicio || 0} onChange={(e) => onAtualizarFormData(reg.id, { ...formData, minuto_inicio: parseInt(e.target.value) || 0 })} className="timer-edit-time-input" min="0" max="59" />
                                  <span>min</span>
                                </div>
                              </div>
                            </div>
                            <div className="timer-edit-form-group" style={{ marginTop: '1rem' }}>
                              <label className="planilha-horas-modal-label">Fim</label>
                              <div className="timer-edit-datetime-row">
                                <FilterDate
                                  label=""
                                  value={formData.data_fim || ''}
                                  onChange={(e) => onAtualizarFormData(reg.id, { ...formData, data_fim: e.target.value })}
                                />
                                <div className="timer-edit-time-wrapper">
                                  <input type="number" value={formData.hora_fim || 0} onChange={(e) => onAtualizarFormData(reg.id, { ...formData, hora_fim: parseInt(e.target.value) || 0 })} className="timer-edit-time-input" min="0" max="23" />
                                  <span>h</span>
                                  <input type="number" value={formData.minuto_fim || 0} onChange={(e) => onAtualizarFormData(reg.id, { ...formData, minuto_fim: parseInt(e.target.value) || 0 })} className="timer-edit-time-input" min="0" max="59" />
                                  <span>min</span>
                                </div>
                              </div>
                            </div>
                            <div className="timer-edit-form-group" style={{ marginTop: '1rem' }}>
                              <label className="planilha-horas-modal-label">Justificativa *</label>
                              <textarea
                                value={formData.justificativa || ''}
                                onChange={(e) => onAtualizarFormData(reg.id, { ...formData, justificativa: e.target.value })}
                                placeholder="Motivo da alteração..."
                                className="planilha-horas-modal-textarea"
                                disabled={salvando}
                              />
                            </div>
                            <div className="planilha-horas-edit-actions">
                              <button className="planilha-horas-btn-cancelar" onClick={() => setRegistroEditandoId(null)} disabled={salvando}>Cancelar</button>
                              <button className="planilha-horas-btn-salvar" onClick={() => handleSalvarEdicao(reg)} disabled={salvando}>
                                {salvando ? 'Salvando...' : 'Salvar'}
                              </button>
                            </div>
                          </div>
                        )}

                        {isDeletando && (
                          <div className="planilha-horas-edit-form delete-form">
                            <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Confirma a exclusão deste registro?</p>
                            <div className="timer-edit-form-group">
                              <label className="planilha-horas-modal-label">Justificativa *</label>
                              <textarea
                                value={justificativaDelecao}
                                onChange={(e) => onAtualizarJustificativaDelecao(reg.id, e.target.value)}
                                placeholder="Motivo da exclusão..."
                                className="planilha-horas-modal-textarea"
                                disabled={salvando}
                              />
                            </div>
                            <div className="planilha-horas-edit-actions">
                              <button className="planilha-horas-btn-cancelar" onClick={() => setRegistroDeletandoId(null)} disabled={salvando}>Cancelar</button>
                              <button className="planilha-horas-btn-salvar" style={{ background: '#ef4444' }} onClick={() => handleConfirmarDelecao(reg)} disabled={salvando}>
                                {salvando ? 'Excluindo...' : 'Confirmar Exclusão'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PlanilhaHoras;

