import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import TimerButton from '../../components/common/TimerButton';
import HistoTempoRastreado from './HistoTempoRastreado';
import '../../components/common/ActionButtons.css';
import '../filters/FilterDate.css';
import './TimerAtivo.css';

const TimerAtivo = () => {
  const { usuario } = useAuth();
  const showToast = useToast();
  const [registroAtivo, setRegistroAtivo] = useState(null);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [tarefaNome, setTarefaNome] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [tempoEstimado, setTempoEstimado] = useState(null);
  const [historicoRegistros, setHistoricoRegistros] = useState([]);
  const [nomesTarefas, setNomesTarefas] = useState({});
  const [nomesClientes, setNomesClientes] = useState({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [registroEditandoId, setRegistroEditandoId] = useState(null);
  const [registroDeletandoId, setRegistroDeletandoId] = useState(null);
  const [formDataPorRegistro, setFormDataPorRegistro] = useState({});
  const [justificativaDelecaoPorRegistro, setJustificativaDelecaoPorRegistro] = useState({});
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);

  // Buscar registro ativo
  const buscarRegistroAtivo = async () => {
    if (!usuario || !usuario.id) {
      return;
    }

    try {
      // Buscar todos os registros ativos do usuário
      const response = await fetch(
        `/api/registro-tempo/ativos?usuario_id=${usuario.id}`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          // Pegar o primeiro registro ativo (ou o mais recente)
          const registro = result.data[0];
          setRegistroAtivo(registro);

          // Buscar informações completas da tarefa e cliente
          // (Alterado: Buscar mesmo se não tiver tarefa_id, para pegar nome do cliente e usar observação)
          if (registro.tarefa_id || registro.cliente_id || registro.is_pendente) {
            buscarInformacoesTarefa(registro);
          }

          // REMOVIDO: Buscar tempo estimado - IDs virtuais não podem ser buscados diretamente
          // O tempo estimado não é crítico para o funcionamento do timer ativo
          // if (registro.tempo_estimado_id) {
          //   buscarTempoEstimado(registro.tempo_estimado_id);
          // }
        } else {
          setRegistroAtivo(null);
          setTarefaNome('');
          setClienteNome('');
          setTempoEstimado(null);
        }
      } else if (response.status === 401) {
        // Sessão expirada - redirecionar para login
        const errorData = await response.json().catch(() => ({}));
        console.warn('[TimerAtivo] Sessão expirada, redirecionando para login');
        if (errorData.redirect) {
          window.location.href = errorData.redirect;
        } else {
          window.location.href = '/login';
        }
      } else {
        const errorText = await response.text();
        console.error('[TimerAtivo] Erro na resposta:', response.status, errorText);
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao buscar registro ativo:', error);
    }
  };

  // Buscar informações da tarefa (nome e cliente)
  const buscarInformacoesTarefa = async (registro) => {
    try {
      // Buscar nome da tarefa
      if (registro.tarefa_id) {
        try {
          const tarefaResponse = await fetch(`/api/tarefas-por-ids?ids=${registro.tarefa_id}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (tarefaResponse.ok) {
            const tarefaResult = await tarefaResponse.json();
            if (tarefaResult.success && tarefaResult.data) {
              const tarefaData = tarefaResult.data[registro.tarefa_id];
              if (tarefaData) {
                setTarefaNome(tarefaData || 'Tarefa');
              }
            } else {
              // Fallback se não encontrar a tarefa pelo ID
              setTarefaNome('Tarefa não encontrada');
            }
          }
        } catch (error) {
          console.warn('[TimerAtivo] Erro ao buscar nome da tarefa:', error);
          setTarefaNome('Erro ao buscar tarefa');
        }
      } else if (registro.is_pendente && registro.observacao) {
        // Se for pendente e não tiver tarefa, usar a observação (comentário)
        setTarefaNome(registro.observacao);
      } else {
        setTarefaNome('Sem Tarefa Definida');
      }

      // Buscar nome do cliente
      if (registro.cliente_id) {
        try {
          const clienteResponse = await fetch(`/api/clientes/${registro.cliente_id}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (clienteResponse.ok) {
            const clienteResult = await clienteResponse.json();
            if (clienteResult.success && clienteResult.data) {
              // O backend pode retornar { cliente: ... } ou o objeto direto
              const cliente = clienteResult.data.cliente || clienteResult.data;

              // Priorizar: nome > nome_amigavel > nome_fantasia > razao_social
              const nome = cliente.nome ||
                cliente.nome_amigavel ||
                cliente.amigavel ||
                cliente.nome_fantasia ||
                cliente.fantasia ||
                cliente.razao_social ||
                cliente.razao ||
                'Cliente';

              setClienteNome(nome);
            }
          }
        } catch (error) {
          console.warn('[TimerAtivo] Erro ao buscar nome do cliente:', error);
        }
      }
    } catch (error) {
      console.warn('[TimerAtivo] Erro ao buscar informações da tarefa:', error);
    }
  };

  // Buscar tempo estimado
  const buscarTempoEstimado = async (tempoEstimadoId) => {
    try {
      const response = await fetch(`/api/tempo-estimado/${tempoEstimadoId}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      // IDs virtuais (gerados dinamicamente a partir de regras) não existem na tabela antiga
      // então retornarão 404 ou 500, o que é esperado e não deve ser tratado como erro
      if (!response.ok) {
        // ID virtual ou registro não encontrado - não pode ser buscado diretamente, ignorar silenciosamente
        return;
      }

      const result = await response.json();
      if (result.success && result.data) {
        let tempo = result.data.tempo_estimado_dia || result.data.tempo_estimado_total || 0;
        // Se o tempo for menor que 1000, provavelmente está em horas decimais
        // Se for maior ou igual a 1000, provavelmente já está em milissegundos
        if (tempo > 0 && tempo < 1000) {
          // Converter horas decimais para milissegundos
          tempo = tempo * 3600000;
        }
        setTempoEstimado(tempo);
      }
    } catch (error) {
      // Erro de rede ou outros erros - ignorar silenciosamente
      // (IDs virtuais não podem ser buscados diretamente)
    }
  };

  // Buscar histórico de registros
  const buscarHistorico = async () => {
    if (!usuario || !usuario.id) return;

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
          console.log('[TimerAtivo] Histórico recebido:', registros.length, 'registros');
          // Log para debug: verificar datas dos registros
          const datasUnicas = [...new Set(registros.map(r => r.data_inicio ? new Date(r.data_inicio).toISOString().split('T')[0] : null).filter(Boolean))];
          console.log('[TimerAtivo] Datas únicas encontradas:', datasUnicas);
          setHistoricoRegistros(registros);

          // Buscar nomes das tarefas (otimizado - uma única requisição)
          const tarefasIds = [...new Set(result.data.map(r => r.tarefa_id).filter(Boolean))];

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
              console.warn('[TimerAtivo] Erro ao buscar nomes das tarefas:', error);
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

          // Buscar nomes dos clientes (buscar individualmente já que não há endpoint em lote)
          const clientesIds = [...new Set(result.data.map(r => r.cliente_id).filter(Boolean))];

          if (clientesIds.length > 0) {
            try {
              // Buscar clientes individualmente em paralelo usando o mesmo endpoint do PainelUsuario
              const clientesPromises = clientesIds.map(async (clienteId) => {
                try {
                  const idStr = String(clienteId).trim();
                  const clienteResponse = await fetch(`/api/base-conhecimento/cliente/${idStr}`, {
                    credentials: 'include',
                    headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json'
                    }
                  });

                  if (clienteResponse.ok) {
                    const clienteResult = await clienteResponse.json();
                    if (clienteResult.success && clienteResult.data && clienteResult.data.cliente) {
                      const cliente = clienteResult.data.cliente;
                      // Priorizar: nome > nome_amigavel > nome_fantasia > razao_social (mesma lógica do PainelUsuario)
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
                  console.warn(`[TimerAtivo] Erro ao buscar cliente ${clienteId}:`, error);
                }
                // Não retornar "Cliente #ID" - deixar null para que HistoTempoRastreado busque assincronamente
                return { id: clienteId, nome: null };
              });

              const clientesData = await Promise.all(clientesPromises);
              const nomes = {};
              clientesData.forEach(cliente => {
                // Só adicionar ao cache se tiver nome válido
                if (cliente.nome) {
                  nomes[cliente.id] = cliente.nome;
                }
              });
              setNomesClientes(nomes);
            } catch (error) {
              console.warn('[TimerAtivo] Erro ao buscar nomes dos clientes:', error);
              // Não criar fallback com "Cliente #ID" - deixar vazio para busca assíncrona
              setNomesClientes({});
            }
          } else {
            setNomesClientes({});
          }
        }
      } else if (response.status === 401) {
        // Sessão expirada - redirecionar para login
        const errorData = await response.json().catch(() => ({}));
        console.warn('[TimerAtivo] Sessão expirada ao buscar histórico, redirecionando para login');
        if (errorData.redirect) {
          window.location.href = errorData.redirect;
        } else {
          window.location.href = '/login';
        }
      }
    } catch (error) {
      console.warn('[TimerAtivo] Erro ao buscar histórico:', error);
    }
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      buscarHistorico(); // Buscar histórico quando abrir o dropdown
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, usuario]);

  useEffect(() => {
    if (!usuario || !usuario.id) {
      return;
    }

    buscarRegistroAtivo();

    // Buscar novamente a cada 3 segundos (mais frequente para detectar mudanças)
    const interval = setInterval(() => {
      buscarRegistroAtivo();
    }, 3000);

    // Escutar eventos de início/fim de registro
    const handleRegistroIniciado = () => {
      // Atualizar imediatamente quando outro componente iniciar
      setTimeout(() => {
        buscarRegistroAtivo();
      }, 100); // Pequeno delay para garantir que o backend processou
    };

    const handleRegistroFinalizado = () => {
      // Atualizar imediatamente quando outro componente parar
      setTimeout(() => {
        buscarRegistroAtivo();
      }, 100); // Pequeno delay para garantir que o backend processou
    };

    window.addEventListener('registro-tempo-iniciado', handleRegistroIniciado);
    window.addEventListener('registro-tempo-finalizado', handleRegistroFinalizado);

    return () => {
      clearInterval(interval);
      window.removeEventListener('registro-tempo-iniciado', handleRegistroIniciado);
      window.removeEventListener('registro-tempo-finalizado', handleRegistroFinalizado);
    };
  }, [usuario]);

  // Atualizar tempo decorrido em tempo real
  useEffect(() => {
    if (!registroAtivo || !registroAtivo.data_inicio) {
      setTempoDecorrido(0);
      return;
    }

    const atualizarTempo = () => {
      const agora = new Date();
      const inicio = new Date(registroAtivo.data_inicio);
      const diferenca = agora.getTime() - inicio.getTime();
      setTempoDecorrido(diferenca);
    };

    atualizarTempo();
    const interval = setInterval(atualizarTempo, 1000);
    return () => clearInterval(interval);
  }, [registroAtivo]);

  // Formatar tempo em formato HH:MM:SS (ex: "2:32:56")
  const formatarTempo = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0:00:00';

    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    const horasStr = String(horas).padStart(1, '0');
    const minutosStr = String(minutos).padStart(2, '0');
    const segundosStr = String(segundos).padStart(2, '0');

    return `${horasStr}:${minutosStr}:${segundosStr}`;
  };

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

  // Formatar data/hora
  const formatarDataHora = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Formatar período (data início - data fim) sem repetir data se for o mesmo dia
  const formatarPeriodo = (dataInicio, dataFim) => {
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
  };

  // Formatar data para agrupamento
  const formatarDataGrupo = (dataString) => {
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
  };

  // Agrupar histórico por data, depois por cliente, e depois por tarefa
  const agruparHistoricoPorDataETarefa = () => {
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
          clientes: {}
        };
      }

      // Agrupar por cliente dentro de cada data
      const clienteId = registro.cliente_id || 'sem-cliente';
      if (!gruposPorData[chaveData].clientes[clienteId]) {
        gruposPorData[chaveData].clientes[clienteId] = {
          cliente_id: clienteId,
          tarefas: {}
        };
      }

      // Agrupar por tarefa dentro de cada cliente
      const tarefaId = registro.tarefa_id || 'sem-tarefa';
      if (!gruposPorData[chaveData].clientes[clienteId].tarefas[tarefaId]) {
        gruposPorData[chaveData].clientes[clienteId].tarefas[tarefaId] = {
          tarefa_id: tarefaId,
          registros: []
        };
      }
      gruposPorData[chaveData].clientes[clienteId].tarefas[tarefaId].registros.push(registro);
    });

    // Ordenar registros de cada tarefa por hora de início (mais recente primeiro)
    Object.keys(gruposPorData).forEach(chaveData => {
      Object.keys(gruposPorData[chaveData].clientes).forEach(clienteId => {
        Object.keys(gruposPorData[chaveData].clientes[clienteId].tarefas).forEach(tarefaId => {
          gruposPorData[chaveData].clientes[clienteId].tarefas[tarefaId].registros.sort((a, b) => {
            const dataA = new Date(a.data_inicio);
            const dataB = new Date(b.data_inicio);
            return dataB - dataA; // Mais recente primeiro
          });
        });
      });
    });

    // Ordenar as datas (mais recente primeiro)
    const datasOrdenadas = Object.keys(gruposPorData).sort((a, b) => {
      return new Date(b) - new Date(a);
    });

    // Retornar como array ordenado
    return datasOrdenadas.map(chaveData => gruposPorData[chaveData]);
  };

  // Calcular total de uma lista de registros
  const calcularTotal = (registros) => {
    return registros.reduce((total, reg) => {
      return total + (reg.tempo_realizado || 0);
    }, 0);
  };

  // Handler para abrir/fechar dropdown
  const handleContainerClick = (e) => {
    // Não abrir se clicar no botão de parar
    if (e.target.closest('.timer-ativo-stop-btn')) {
      return;
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Abrir/fechar edição
  const handleEditar = (e, registro) => {
    e.stopPropagation();

    if (registroEditandoId === registro.id) {
      // Se já está editando, fecha
      setRegistroEditandoId(null);
      return;
    }

    const dataInicio = new Date(registro.data_inicio);
    const dataFim = registro.data_fim ? new Date(registro.data_fim) : new Date();

    // Extrair data (YYYY-MM-DD)
    const formatarData = (date) => {
      const ano = date.getFullYear();
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const dia = String(date.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    };

    setRegistroEditandoId(registro.id);
    setFormDataPorRegistro({
      ...formDataPorRegistro,
      [registro.id]: {
        data_inicio: formatarData(dataInicio),
        hora_inicio: dataInicio.getHours(),
        minuto_inicio: dataInicio.getMinutes(),
        data_fim: formatarData(dataFim),
        hora_fim: dataFim.getHours(),
        minuto_fim: dataFim.getMinutes(),
        justificativa: ''
      }
    });

    // Fechar exclusão se estiver aberta
    if (registroDeletandoId === registro.id) {
      setRegistroDeletandoId(null);
    }
  };

  // Fechar edição
  const handleFecharEdicao = (registroId) => {
    if (registroId) {
      setRegistroEditandoId(null);
      const newFormData = { ...formDataPorRegistro };
      delete newFormData[registroId];
      setFormDataPorRegistro(newFormData);
    } else {
      setRegistroEditandoId(null);
    }
  };

  // Validar edição de registro de tempo
  const validarEdicao = (dataInicio, dataFim, registroId, registro) => {
    const agora = new Date();

    // 1. Validar que o registro está finalizado (tem data_fim)
    if (!registro || !registro.data_fim) {
      return {
        valido: false,
        erro: 'Apenas registros finalizados podem ser editados'
      };
    }

    // 2. Validar não-futuro
    if (dataInicio > agora) {
      return {
        valido: false,
        erro: 'Data de início não pode ser no futuro'
      };
    }

    if (dataFim > agora) {
      return {
        valido: false,
        erro: 'Data de fim não pode ser no futuro'
      };
    }

    // 3. Validar ordem cronológica
    if (dataInicio >= dataFim) {
      return {
        valido: false,
        erro: 'Data de início deve ser anterior à data de fim'
      };
    }

    // 4. Validar duração mínima (1 segundo)
    const duracao = dataFim.getTime() - dataInicio.getTime();
    if (duracao < 1000) {
      return {
        valido: false,
        erro: 'Duração mínima é de 1 segundo'
      };
    }

    return { valido: true };
  };

  // Validar sobreposição com outros registros
  const validarSobreposicao = async (dataInicio, dataFim, registroId) => {
    if (!usuario || !usuario.id) {
      return { valido: false, erro: 'Usuário não identificado' };
    }

    try {
      // Buscar todos os registros finalizados do usuário (exceto o atual)
      const response = await fetch(
        `/api/registro-tempo/historico?usuario_id=${usuario.id}&limite=1000`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        // SMART EDIT: O backend agora lida com ajustes automáticos de sobreposição.
        // Portanto, não bloqueamos mais no frontend.
        // Apenas retornamos true para permitir o envio.
        return { valido: true };
      }

      return { valido: true };
    } catch (error) {
      console.error('[TimerAtivo] Erro ao validar sobreposição:', error);
      // Em caso de erro na validação, permitir (o backend vai validar também)
      return { valido: true };
    }
  };

  // Salvar edição
  const handleSalvarEdicao = async (registro) => {
    if (!registro || !registroEditandoId || registroEditandoId !== registro.id) return;

    const formData = formDataPorRegistro[registro.id];
    if (!formData) return;

    try {
      // Validar justificativa obrigatória
      if (!formData.justificativa || formData.justificativa.trim() === '') {
        showToast('error', 'Justificativa é obrigatória para editar o registro');
        return;
      }

      // Combinar data, hora e minuto
      const dataInicioCompleta = new Date(
        `${formData.data_inicio}T${String(formData.hora_inicio).padStart(2, '0')}:${String(formData.minuto_inicio).padStart(2, '0')}:00`
      );
      const dataFimCompleta = new Date(
        `${formData.data_fim}T${String(formData.hora_fim).padStart(2, '0')}:${String(formData.minuto_fim).padStart(2, '0')}:00`
      );

      // Validar edição
      const validacao = validarEdicao(dataInicioCompleta, dataFimCompleta, registro.id, registro);
      if (!validacao.valido) {
        showToast('error', validacao.erro);
        return;
      }

      // Validar sobreposição
      const validacaoSobreposicao = await validarSobreposicao(
        dataInicioCompleta,
        dataFimCompleta,
        registro.id
      );
      if (!validacaoSobreposicao.valido) {
        showToast('error', validacaoSobreposicao.erro);
        return;
      }

      const response = await fetch(`/api/registro-tempo/${registro.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          data_inicio: dataInicioCompleta.toISOString(),
          data_fim: dataFimCompleta.toISOString(),
          justificativa: formData.justificativa.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('[TimerAtivo] Erro ao atualizar registro:', response.status, errorData);
        showToast('error', errorData.error || errorData.details || 'Erro ao atualizar registro');
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Atualizar histórico
        await buscarHistorico();
        handleFecharEdicao(registro.id);

        // Disparar evento para atualizar outros componentes
        window.dispatchEvent(new CustomEvent('registro-tempo-atualizado'));
        showToast('success', 'Registro de tempo atualizado com sucesso!');
      } else {
        console.error('[TimerAtivo] Erro ao atualizar registro:', result);
        showToast('error', result.error || result.details || 'Erro ao atualizar registro');
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao salvar edição:', error);
      showToast('error', `Erro ao salvar edição: ${error.message || 'Erro desconhecido'}`);
    }
  };

  // Abrir/fechar exclusão
  const handleDeletar = (e, registro) => {
    e.stopPropagation();

    if (registroDeletandoId === registro.id) {
      // Se já está excluindo, fecha
      setRegistroDeletandoId(null);
      return;
    }

    setRegistroDeletandoId(registro.id);
    setJustificativaDelecaoPorRegistro({
      ...justificativaDelecaoPorRegistro,
      [registro.id]: ''
    });

    // Fechar edição se estiver aberta
    if (registroEditandoId === registro.id) {
      setRegistroEditandoId(null);
    }
  };

  // Fechar exclusão
  const handleFecharDelecao = (registroId) => {
    setRegistroDeletandoId(null);
    if (registroId) {
      const newJustificativas = { ...justificativaDelecaoPorRegistro };
      delete newJustificativas[registroId];
      setJustificativaDelecaoPorRegistro(newJustificativas);
    }
  };

  // Wrapper para atualizar formData
  const handleAtualizarFormData = (registroId, novoFormData) => {
    setFormDataPorRegistro({
      ...formDataPorRegistro,
      [registroId]: novoFormData
    });
  };

  // Wrapper para atualizar justificativa de deleção
  const handleAtualizarJustificativaDelecao = (registroId, justificativa) => {
    setJustificativaDelecaoPorRegistro({
      ...justificativaDelecaoPorRegistro,
      [registroId]: justificativa
    });
  };

  // Confirmar exclusão
  const handleConfirmarDelecao = async (registro) => {
    if (!registro || !registroDeletandoId || registroDeletandoId !== registro.id) return;

    const justificativa = justificativaDelecaoPorRegistro[registro.id] || '';

    // Validar justificativa obrigatória
    if (!justificativa || justificativa.trim() === '') {
      showToast('error', 'Justificativa é obrigatória para excluir o registro');
      return;
    }

    try {
      const response = await fetch(`/api/registro-tempo/${registro.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          justificativa: justificativa.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('[TimerAtivo] Erro ao excluir registro:', response.status, errorData);
        showToast('error', errorData.error || errorData.details || 'Erro ao excluir registro');
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Atualizar histórico
        await buscarHistorico();

        // Fechar exclusão
        handleFecharDelecao(registro.id);

        // Disparar evento para atualizar outros componentes
        window.dispatchEvent(new CustomEvent('registro-tempo-deletado'));
        showToast('success', 'Registro de tempo excluído com sucesso!');
      } else {
        console.error('[TimerAtivo] Erro ao excluir registro:', result);
        showToast('error', result.error || result.details || 'Erro ao excluir registro');
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao excluir registro:', error);
      showToast('error', `Erro ao excluir registro: ${error.message || 'Erro desconhecido'}`);
    }
  };

  // Parar o timer
  const handleParar = async (e) => {
    e.stopPropagation(); // Prevenir que abra o dropdown
    if (!registroAtivo || !usuario) return;

    try {
      let response;
      if (registroAtivo.is_pendente) {
        // Parar timer de atribuição pendente
        response = await fetch('/api/atribuicoes-pendentes/parar-timer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ atribuicao_pendente_id: registroAtivo.atribuicao_pendente_id })
        });
      } else {
        // Parar timer normal
        response = await fetch(`/api/registro-tempo/finalizar/${registroAtivo.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            tarefa_id: registroAtivo.tarefa_id,
            usuario_id: usuario.id
          })
        });
      }

      const result = await response.json();

      if (response.ok && result.success) {
        setRegistroAtivo(null);
        setTarefaNome('');
        setTempoDecorrido(0);

        // Disparar evento customizado para atualizar o painel
        window.dispatchEvent(new CustomEvent('registro-tempo-finalizado'));

        // Buscar novamente para garantir que está atualizado
        setTimeout(() => {
          buscarRegistroAtivo();
        }, 500);
        showToast('success', 'Timer parado com sucesso!');
      } else {
        console.error('[TimerAtivo] Erro ao finalizar registro:', result);
        showToast('error', result.error || 'Erro ao parar o timer');
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao parar timer:', error);
      showToast('error', 'Erro ao parar o timer');
    }
  };

  const historicoAgrupadoPorData = agruparHistoricoPorDataETarefa();

  const renderDropdownFooter = () => (
    <div className="timer-dropdown-footer">
      <Link
        to="/planilha-horas"
        className="timer-dropdown-footer-btn"
        onClick={() => setIsDropdownOpen(false)}
      >
        <i className="fas fa-calendar-alt"></i> Minha planilha de horas
      </Link>
      <Link
        to="/painel-colaborador"
        className="timer-dropdown-footer-btn"
        onClick={() => setIsDropdownOpen(false)}
      >
        <i className="fas fa-th-large"></i> Painel
      </Link>
    </div>
  );

  // Se não houver registro ativo, mostrar apenas botão de histórico
  if (!registroAtivo) {
    return (
      <div className="timer-ativo-wrapper">
        <div
          ref={containerRef}
          className="timer-ativo-container timer-ativo-container-historico"
          onClick={handleContainerClick}
          style={{ cursor: 'pointer' }}
          title="Ver histórico de tempo"
        >
          <i className="far fa-clock timer-ativo-historico-icon"></i>
        </div>

        {isDropdownOpen && (
          <div ref={dropdownRef} className="timer-ativo-dropdown">
            {/* Histórico */}
            <div className="timer-dropdown-section">
              <div className="timer-dropdown-header">
                <span className="timer-dropdown-title">Histórico</span>
              </div>
              <HistoTempoRastreado
                historicoAgrupadoPorData={historicoAgrupadoPorData}
                nomesTarefas={nomesTarefas}
                nomesClientes={nomesClientes}
                formatarTempoHMS={formatarTempoHMS}
                formatarPeriodo={formatarPeriodo}
                calcularTotal={calcularTotal}
                onEditar={handleEditar}
                onDeletar={handleDeletar}
                onSalvarEdicao={handleSalvarEdicao}
                onConfirmarDelecao={handleConfirmarDelecao}
                onFecharEdicao={handleFecharEdicao}
                onFecharDelecao={handleFecharDelecao}
                onAtualizarFormData={handleAtualizarFormData}
                onAtualizarJustificativaDelecao={handleAtualizarJustificativaDelecao}
                onBuscarHistorico={buscarHistorico}
                registroEditandoId={registroEditandoId}
                registroDeletandoId={registroDeletandoId}
                formDataPorRegistro={formDataPorRegistro}
                justificativaDelecaoPorRegistro={justificativaDelecaoPorRegistro}
              />
            </div>
            {renderDropdownFooter()}
          </div>
        )}
      </div>
    );
  }

  // Se houver registro ativo, mostrar timer normal com histórico
  return (
    <div className="timer-ativo-wrapper">
      <div
        ref={containerRef}
        className="timer-ativo-container"
        onClick={handleContainerClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="timer-ativo-tempo">
          {formatarTempo(tempoDecorrido)}
        </div>
        <TimerButton
          isActive={true}
          onClick={handleParar}
          className="timer-button-header"
        />
      </div>

      {isDropdownOpen && (
        <div ref={dropdownRef} className="timer-ativo-dropdown">
          {/* Tarefa Atual Ativa */}
          <div className="timer-dropdown-section">
            <div className="timer-dropdown-header">
              <span className="timer-dropdown-title">Rastreamento de Tempo</span>
            </div>
            <div className="timer-dropdown-tarefa-ativa">
              <div className="timer-dropdown-tarefa-nome" title={tarefaNome || 'Tarefa'}>
                {tarefaNome && tarefaNome.length > 40 ? tarefaNome.substring(0, 40) + '...' : (tarefaNome || 'Tarefa')}
              </div>
              {clienteNome && (
                <div className="timer-dropdown-cliente-nome-inline">{clienteNome}</div>
              )}
              <div className="timer-dropdown-tempo-info">
                <span className="timer-dropdown-tempo-atual">
                  {formatarTempo(tempoDecorrido)}
                </span>
                {tempoEstimado && tempoEstimado > 0 && (
                  <span className="timer-dropdown-tempo-estimado">
                    / {formatarTempoHMS(Math.round(tempoEstimado))}
                  </span>
                )}
              </div>
              <div className="timer-dropdown-data">
                {formatarPeriodo(registroAtivo.data_inicio, null)}
              </div>
            </div>
          </div>

          {/* Histórico */}
          <div className="timer-dropdown-section">
            <div className="timer-dropdown-header">
              <span className="timer-dropdown-title">Histórico</span>
            </div>
            <HistoTempoRastreado
              historicoAgrupadoPorData={historicoAgrupadoPorData}
              nomesTarefas={nomesTarefas}
              nomesClientes={nomesClientes}
              formatarTempoHMS={formatarTempoHMS}
              formatarPeriodo={formatarPeriodo}
              calcularTotal={calcularTotal}
              onEditar={handleEditar}
              onDeletar={handleDeletar}
              onSalvarEdicao={handleSalvarEdicao}
              onConfirmarDelecao={handleConfirmarDelecao}
              onFecharEdicao={handleFecharEdicao}
              onFecharDelecao={handleFecharDelecao}
              onAtualizarFormData={handleAtualizarFormData}
              onAtualizarJustificativaDelecao={handleAtualizarJustificativaDelecao}
              onBuscarHistorico={buscarHistorico}
              registroEditandoId={registroEditandoId}
              registroDeletandoId={registroDeletandoId}
              formDataPorRegistro={formDataPorRegistro}
              justificativaDelecaoPorRegistro={justificativaDelecaoPorRegistro}
            />
          </div>
          {renderDropdownFooter()}
        </div>
      )}
    </div>
  );
};

export default TimerAtivo;


