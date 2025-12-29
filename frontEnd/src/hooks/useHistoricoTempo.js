import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook customizado para gerenciar histórico de tempo rastreado
 * Centraliza toda a lógica de busca, agrupamento e formatação
 */
export const useHistoricoTempo = () => {
  const { usuario } = useAuth();
  const [historicoRegistros, setHistoricoRegistros] = useState([]);
  const [nomesTarefas, setNomesTarefas] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Formatar tempo em horas/minutos/segundos
  const formatarTempoHMS = useCallback((milissegundos) => {
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
  }, []);

  // Formatar período (data início - data fim) sem repetir data se for o mesmo dia
  const formatarPeriodo = useCallback((dataInicio, dataFim) => {
    if (!dataInicio) return '';
    
    const inicio = new Date(dataInicio);
    const fim = dataFim ? new Date(dataFim) : null;
    
    // Formatar data de início
    const dataInicioFormatada = inicio.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const horaInicioFormatada = inicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (!fim) {
      return `${dataInicioFormatada}, ${horaInicioFormatada} - Agora`;
    }
    
    // Verificar se é o mesmo dia
    const mesmoDia = inicio.toDateString() === fim.toDateString();
    
    if (mesmoDia) {
      // Mesmo dia: mostrar data uma vez e depois só as horas
      const horaFimFormatada = fim.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${dataInicioFormatada}, ${horaInicioFormatada} - ${horaFimFormatada}`;
    } else {
      // Dias diferentes: mostrar data completa para ambos
      const dataFimFormatada = fim.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const horaFimFormatada = fim.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${dataInicioFormatada}, ${horaInicioFormatada} - ${dataFimFormatada}, ${horaFimFormatada}`;
    }
  }, []);

  // Formatar data para agrupamento
  const formatarDataGrupo = useCallback((dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    
    // Normalizar para comparar apenas a data (sem hora)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const dataNormalizada = new Date(data);
    dataNormalizada.setHours(0, 0, 0, 0);
    
    if (dataNormalizada.getTime() === hoje.getTime()) {
      return 'Hoje';
    } else if (dataNormalizada.getTime() === ontem.getTime()) {
      return 'Ontem';
    } else {
      return data.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
      });
    }
  }, []);

  // Calcular total de uma lista de registros
  const calcularTotal = useCallback((registros) => {
    return registros.reduce((total, reg) => {
      return total + (reg.tempo_realizado || 0);
    }, 0);
  }, []);

  // Buscar histórico de registros
  const buscarHistorico = useCallback(async () => {
    if (!usuario || !usuario.id) return;

    setLoading(true);
    setError(null);

    try {
      // Buscar histórico sem filtro de data - aumentar limite para pegar mais registros
      const response = await fetch(
        `/api/registro-tempo/historico?usuario_id=${usuario.id}&limite=1000`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const registros = result.data || [];
          setHistoricoRegistros(registros);
          
          // Buscar nomes das tarefas (otimizado - uma única requisição)
          const tarefasIds = [...new Set(registros.map(r => r.tarefa_id).filter(Boolean))];
          
          if (tarefasIds.length > 0) {
            try {
              const tarefasResponse = await fetch(
                `/api/tarefas-por-ids?ids=${tarefasIds.join(',')}`,
                {
                  credentials: 'include',
                  headers: { 'Accept': 'application/json' }
                }
              );
              
              if (tarefasResponse.ok) {
                const tarefasResult = await tarefasResponse.json();
                if (tarefasResult.success && tarefasResult.data) {
                  // tarefasResult.data já é um objeto { id: nome }
                  const nomes = {};
                  tarefasIds.forEach(tarefaId => {
                    nomes[tarefaId] = tarefasResult.data[tarefaId] || `Tarefa #${tarefaId}`;
                  });
                  setNomesTarefas(nomes);
                } else {
                  // Fallback: criar nomes padrão
                  const nomes = {};
                  tarefasIds.forEach(tarefaId => {
                    nomes[tarefaId] = `Tarefa #${tarefaId}`;
                  });
                  setNomesTarefas(nomes);
                }
              } else if (tarefasResponse.status === 401) {
                // Sessão expirada - redirecionar para login
                window.location.href = '/login';
                return;
              } else {
                // Fallback: criar nomes padrão
                const nomes = {};
                tarefasIds.forEach(tarefaId => {
                  nomes[tarefaId] = `Tarefa #${tarefaId}`;
                });
                setNomesTarefas(nomes);
              }
            } catch (error) {
              console.warn('[useHistoricoTempo] Erro ao buscar nomes das tarefas:', error);
              // Fallback: criar nomes padrão
              const nomes = {};
              tarefasIds.forEach(tarefaId => {
                nomes[tarefaId] = `Tarefa #${tarefaId}`;
              });
              setNomesTarefas(nomes);
            }
          } else {
            setNomesTarefas({});
          }
        }
      } else if (response.status === 401) {
        // Sessão expirada - redirecionar para login
        const errorData = await response.json().catch(() => ({}));
        console.warn('[useHistoricoTempo] Sessão expirada ao buscar histórico, redirecionando para login');
        if (errorData.redirect) {
          window.location.href = errorData.redirect;
        } else {
          window.location.href = '/login';
        }
      } else {
        setError('Erro ao buscar histórico');
      }
    } catch (error) {
      console.warn('[useHistoricoTempo] Erro ao buscar histórico:', error);
      setError('Erro ao buscar histórico');
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  // Agrupar histórico por data e depois por tarefa
  const agruparHistoricoPorDataETarefa = useCallback(() => {
    const gruposPorData = {};
    
    historicoRegistros.forEach((registro) => {
      if (!registro.data_inicio) return;
      
      // Usar a data de início para agrupar (apenas a data, sem hora)
      const dataInicio = new Date(registro.data_inicio);
      const chaveData = dataInicio.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!gruposPorData[chaveData]) {
        gruposPorData[chaveData] = {
          data: chaveData,
          dataFormatada: formatarDataGrupo(registro.data_inicio),
          tarefas: {}
        };
      }
      
      // Agrupar por tarefa dentro de cada data
      const tarefaId = registro.tarefa_id || 'sem-tarefa';
      if (!gruposPorData[chaveData].tarefas[tarefaId]) {
        gruposPorData[chaveData].tarefas[tarefaId] = {
          tarefa_id: tarefaId,
          registros: []
        };
      }
      gruposPorData[chaveData].tarefas[tarefaId].registros.push(registro);
    });
    
    // Ordenar registros de cada tarefa por hora de início (mais recente primeiro)
    Object.keys(gruposPorData).forEach(chaveData => {
      Object.keys(gruposPorData[chaveData].tarefas).forEach(tarefaId => {
        gruposPorData[chaveData].tarefas[tarefaId].registros.sort((a, b) => {
          const dataA = new Date(a.data_inicio);
          const dataB = new Date(b.data_inicio);
          return dataB - dataA; // Mais recente primeiro
        });
      });
    });
    
    // Ordenar as datas (mais recente primeiro)
    const datasOrdenadas = Object.keys(gruposPorData).sort((a, b) => {
      return new Date(b) - new Date(a);
    });
    
    // Retornar como array ordenado
    return datasOrdenadas.map(chaveData => gruposPorData[chaveData]);
  }, [historicoRegistros, formatarDataGrupo]);

  return {
    historicoRegistros,
    nomesTarefas,
    historicoAgrupadoPorData: agruparHistoricoPorDataETarefa(),
    loading,
    error,
    buscarHistorico,
    formatarTempoHMS,
    formatarPeriodo,
    calcularTotal
  };
};

