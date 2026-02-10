import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DetalhesFlatList from './DetalhesFlatList';
import TarefasDetalhadasList from './TarefasDetalhadasList';
import TiposTarefaDetalhadosList from './TiposTarefaDetalhadosList';
import './DetailSideCard.css';

const API_BASE_URL = '/api';

// Função para formatar tempo em formato HMS (ex: "35s", "3min 42s", "1h 30min")
const formatarTempoHMS = (milissegundos) => {
  if (!milissegundos || milissegundos === 0) return '0s';
  const totalSegundos = Math.floor(milissegundos / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const partes = [];
  if (horas > 0) partes.push(`${horas}h`);
  if (minutos > 0) partes.push(`${minutos}min`);
  if (segundos > 0 || partes.length === 0) partes.push(`${segundos}s`);
  return partes.join(' ');
};

// Função para formatar data e hora
const formatarDataHora = (dataInput) => {
  if (!dataInput) return '—';
  try {
    const date = new Date(dataInput);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '—';
  }
};

const DetailSideCard = ({ entidadeId, cardTipo, tipo, dados, onClose, position, getTempoRealizado, formatarTempoEstimado, formatarData, calcularCustoPorTempo, formatarValorMonetario, getNomeCliente, getNomeTipoTarefa, periodoInicio, periodoFim, filtrosAdicionais }) => {
  const cardRef = useRef(null);
  const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());
  const [tiposTarefaExpandidos, setTiposTarefaExpandidos] = useState(new Set());
  const [registrosIndividuais, setRegistrosIndividuais] = useState({});
  const [carregandoRegistros, setCarregandoRegistros] = useState({});
  const [nomesColaboradoresPorUsuarioId, setNomesColaboradoresPorUsuarioId] = useState(new Map());
  const [temposRealizadosPorTarefa, setTemposRealizadosPorTarefa] = useState({});
  const [temposRealizadosPorResponsavel, setTemposRealizadosPorResponsavel] = useState({});
  const [temposRealizadosPorCliente, setTemposRealizadosPorCliente] = useState({});
  const [temposRealizadosPorProduto, setTemposRealizadosPorProduto] = useState({});
  // Estados para tempos hierárquicos
  const [temposRealizadosPorTarefaPorCliente, setTemposRealizadosPorTarefaPorCliente] = useState({});
  const [temposRealizadosPorClientePorProduto, setTemposRealizadosPorClientePorProduto] = useState({});
  const [temposRealizadosPorTarefaPorClientePorProduto, setTemposRealizadosPorTarefaPorClientePorProduto] = useState({});
  const [temposRealizadosPorTipoTarefa, setTemposRealizadosPorTipoTarefa] = useState({});
  const [temposRealizadosPorTarefaPorTipoTarefa, setTemposRealizadosPorTarefaPorTipoTarefa] = useState({});

  // Buscar nomes de colaboradores por usuario_id
  useEffect(() => {
    const carregarNomesColaboradores = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/membros-id-nome`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data && Array.isArray(result.data)) {
            const mapa = new Map();
            result.data.forEach(membro => {
              if (membro.usuario_id) {
                mapa.set(String(membro.usuario_id), membro.nome);
              }
            });
            setNomesColaboradoresPorUsuarioId(mapa);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar nomes de colaboradores:', error);
      }
    };

    carregarNomesColaboradores();
  }, []);

  // Função para buscar nome do colaborador por usuario_id
  const getNomeColaboradorPorUsuarioId = (usuarioId) => {
    if (!usuarioId) return null;
    return nomesColaboradoresPorUsuarioId.get(String(usuarioId)) || null;
  };

  // Função auxiliar para normalizar ID do cliente (mesma lógica do ClientesDetalhadosList)
  const normalizarClienteId = (cliente) => {
    if (!cliente) return null;
    // Se tem id, usar id (convertido para string para consistência)
    if (cliente.id) return String(cliente.id);
    // Se nome é UUID, usar nome como ID (mesma lógica do ClientesDetalhadosList linha 201)
    if (cliente.nome && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(cliente.nome))) {
      return String(cliente.nome);
    }
    // Se não encontrou, retornar null (mesma lógica do ClientesDetalhadosList)
    return null;
  };

  // Função auxiliar para normalizar ID (genérico)
  const normalizarId = (item) => {
    if (!item) return '';
    if (item.id) return String(item.id);
    if (item.nome && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.nome))) {
      return String(item.nome);
    }
    return String(item.nome || item.id || '');
  };

  // Buscar tempos realizados para tarefas, responsáveis, clientes e produtos quando os dados são recebidos
  useEffect(() => {
    // Tipos com lista plana: dados já contêm total_realizado_ms e total_estimado_ms por item; sem fetch
    // EXCEÇÃO: tarefas precisa buscar tempos para exibir nos registros individuais
    if (['clientes', 'produtos', 'responsaveis'].includes(tipo)) {
      return;
    }

    if (!dados?.registros || dados.registros.length === 0) {
      setTemposRealizadosPorTarefa({});
      setTemposRealizadosPorResponsavel({});
      setTemposRealizadosPorCliente({});
      setTemposRealizadosPorProduto({});
      setTemposRealizadosPorTarefaPorCliente({});
      setTemposRealizadosPorClientePorProduto({});
      setTemposRealizadosPorTarefaPorClientePorProduto({});
      setTemposRealizadosPorTipoTarefa({});
      setTemposRealizadosPorTarefaPorTipoTarefa({});
      return;
    }

    // Dados já vieram do POST único (gestao-capacidade/cards): usar valores sem nova requisição
    if (dados.preloaded) {
      const byId = {};
      dados.registros.forEach(item => {
        const id = item.id ?? item.originalId;
        if (id != null) {
          const ms = item.tempoRealizado ?? item.total_realizado_ms ?? 0;
          byId[String(id)] = ms;
        }
      });
      if (tipo === 'tarefas') setTemposRealizadosPorTarefa(byId);
      else if (tipo === 'responsaveis') setTemposRealizadosPorResponsavel(byId);
      else if (tipo === 'clientes') setTemposRealizadosPorCliente(byId);
      else if (tipo === 'produtos') setTemposRealizadosPorProduto(byId);
      return;
    }

    // Período: usar prop ou padrão (início/fim do mês atual) para garantir que o realizado por tarefa carregue ao abrir "ver detalhes"
    const periodoInicioUsar = periodoInicio || (() => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    })();
    const periodoFimUsar = periodoFim || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      d.setHours(23, 59, 59, 999);
      return d.toISOString().slice(0, 10);
    })();

    // Backend retorna data como { [entityId]: { tempo_realizado_ms } }, não data.tempo_realizado_ms direto
    const extrairTempoRealizadoMs = (result) => {
      if (!result?.success || !result?.data) return 0;
      const data = result.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const first = Object.values(data)[0];
        if (first && typeof first.tempo_realizado_ms !== 'undefined') return first.tempo_realizado_ms || 0;
      }
      return data?.tempo_realizado_ms || 0;
    };

    const buscarTemposRealizados = async () => {
      if (tipo === 'tarefas') {
        const novosTempos = {};

        // Buscar tempo realizado para cada tarefa (ao abrir "ver detalhes" / painel Tarefas)
        const promises = dados.registros.map(async (tarefa) => {
          // Coletar responsáveis únicos desta tarefa; se vazio, usar entidadeId (ex.: responsável do card) para ainda buscar
          const responsaveisUnicos = new Set();
          if (tarefa.registros && Array.isArray(tarefa.registros)) {
            tarefa.registros.forEach(reg => {
              if (reg.responsavel_id) {
                responsaveisUnicos.add(reg.responsavel_id);
              }
            });
          }
          if (responsaveisUnicos.size === 0 && entidadeId) {
            responsaveisUnicos.add(entidadeId);
          }

          if (responsaveisUnicos.size === 0) {
            return { tarefaId: tarefa.id, tempoRealizado: 0 };
          }

          // Buscar tempo realizado para cada responsável e somar
          let tempoTotal = 0;
          const promisesResponsaveis = Array.from(responsaveisUnicos).map(async (responsavelId) => {
            try {
              const tarefaIdReal = tarefa.originalId || (typeof tarefa.id === 'string' && tarefa.id.includes('_') ? tarefa.id.split('_')[0] : tarefa.id);

              const response = await fetch('/api/registro-tempo/realizado-total', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  responsavel_id: responsavelId,
                  data_inicio: periodoInicioUsar,
                  data_fim: periodoFimUsar,
                  tarefa_id: tarefaIdReal,
                  cliente_id: tarefa.clienteId || filtrosAdicionais?.cliente_id || null,
                  produto_id: filtrosAdicionais?.produto_id || null
                })
              });

              if (response.ok) {
                const result = await response.json();
                return extrairTempoRealizadoMs(result);
              }
              return 0;
            } catch (error) {
              console.error('Erro ao buscar tempo realizado da tarefa:', error);
              return 0;
            }
          });

          const resultados = await Promise.all(promisesResponsaveis);
          tempoTotal = resultados.reduce((sum, tempo) => sum + tempo, 0);

          return { tarefaId: tarefa.id, tempoRealizado: tempoTotal };
        });

        const resultados = await Promise.all(promises);
        resultados.forEach(({ tarefaId, tempoRealizado }) => {
          novosTempos[tarefaId] = tempoRealizado;
        });

        setTemposRealizadosPorTarefa(novosTempos);
      } else if (tipo === 'responsaveis') {
        const novosTempos = {}; // Responsavel ID -> Time
        const novosTemposProduto = {}; // RespID-ProdID -> Time
        const novosTemposCliente = {}; // RespID-ProdID-ClientID -> Time
        const novosTemposTarefa = {}; // RespID-ProdID-ClientID-TaskID -> Time (plus fallback IDs)

        // 1. Fetch Top Level (Responsavel) - Keep existing logic
        const promisesResponsaveis = dados.registros.map(async (responsavel) => {
          try {
            const response = await fetch('/api/registro-tempo/realizado-total', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                responsavel_id: responsavel.id,
                data_inicio: periodoInicioUsar,
                data_fim: periodoFimUsar,
                tarefa_id: filtrosAdicionais?.tarefa_id || null,
                cliente_id: filtrosAdicionais?.cliente_id || null,
                produto_id: filtrosAdicionais?.produto_id || null
              })
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                return { responsavelId: responsavel.id, tempoRealizado: extrairTempoRealizadoMs(result) };
              }
            }
            return { responsavelId: responsavel.id, tempoRealizado: 0 };
          } catch (error) {
            console.error('Erro ao buscar tempo realizado do responsável:', error);
            return { responsavelId: responsavel.id, tempoRealizado: 0 };
          }
        });

        // 2. Fetch Nested Levels
        const promisesNested = dados.registros.map(async (responsavel) => {
          if (!responsavel.produtos || !Array.isArray(responsavel.produtos)) return;

          await Promise.all(responsavel.produtos.map(async (produto) => {
            const produtoKey = `${responsavel.id}-${produto.id}`;
            const produtoKeyAlt = String(produto.id);

            // Buscar tempo do produto para este responsável específico
            try {
              const response = await fetch('/api/registro-tempo/realizado-total', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  responsavel_id: responsavel.id,
                  data_inicio: periodoInicioUsar,
                  data_fim: periodoFimUsar,
                  produto_id: produto.id,
                  cliente_id: filtrosAdicionais?.cliente_id || null
                })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                  const tempoMs = extrairTempoRealizadoMs(result);
                  novosTemposProduto[produtoKey] = tempoMs;
                  // Não sobrescrever a chave simples se já existir (pode vir de outro responsável), 
                  // mas para visualização detalhada precisamos da chave composta.
                  // A chave simples é apenas fallback.
                  if (!novosTemposProduto[produtoKeyAlt]) novosTemposProduto[produtoKeyAlt] = tempoMs;
                }
              }
            } catch (err) { console.error(err); }

            // Tarefas diretamente no produto (sem cliente): chave resp-prod-tarefa
            if (produto.tarefas && Array.isArray(produto.tarefas) && produto.tarefas.length > 0) {
              await Promise.all(produto.tarefas.map(async (tarefa) => {
                const tarefaKey3 = `${responsavel.id}-${produto.id}-${tarefa.id}`;
                const tarefaKeyAlt = String(tarefa.id);
                try {
                  const response = await fetch('/api/registro-tempo/realizado-total', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      responsavel_id: responsavel.id,
                      data_inicio: periodoInicioUsar,
                      data_fim: periodoFimUsar,
                      produto_id: produto.id,
                      cliente_id: filtrosAdicionais?.cliente_id || null,
                      tarefa_id: tarefa.originalId || (typeof tarefa.id === 'string' && tarefa.id.includes('_') ? tarefa.id.split('_')[0] : tarefa.id)
                    })
                  });
                  if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                      const tempoMs = extrairTempoRealizadoMs(result);
                      novosTemposTarefa[tarefaKey3] = tempoMs;
                      if (novosTemposTarefa[tarefaKeyAlt] === undefined) novosTemposTarefa[tarefaKeyAlt] = tempoMs;
                    }
                  }
                } catch (err) { console.error(err); }
              }));
            }

            if (!produto.clientes || !Array.isArray(produto.clientes)) return;

            await Promise.all(produto.clientes.map(async (cliente) => {
              const clienteKey = `${responsavel.id}-${produto.id}-${cliente.id}`;
              const clienteKeyAlt = String(cliente.id);

              // Buscar tempo do cliente para este responsável E produto
              try {
                const response = await fetch('/api/registro-tempo/realizado-total', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    responsavel_id: responsavel.id,
                    data_inicio: periodoInicioUsar,
                    data_fim: periodoFimUsar,
                    produto_id: produto.id,
                    cliente_id: cliente.id
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  if (result.success && result.data) {
                    const tempoMs = extrairTempoRealizadoMs(result);
                    novosTemposCliente[clienteKey] = tempoMs;
                    if (!novosTemposCliente[clienteKeyAlt]) novosTemposCliente[clienteKeyAlt] = tempoMs;
                  }
                }
              } catch (err) { console.error(err); }

              if (!cliente.tarefas || !Array.isArray(cliente.tarefas)) return;

              await Promise.all(cliente.tarefas.map(async (tarefa) => {
                const tarefaKey = `${responsavel.id}-${produto.id}-${cliente.id}-${tarefa.id}`;
                const tarefaKeyAlt = String(tarefa.id);

                // Buscar tempo da tarefa para este responsável, produto e cliente
                try {
                  const response = await fetch('/api/registro-tempo/realizado-total', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      responsavel_id: responsavel.id,
                      data_inicio: periodoInicioUsar,
                      data_fim: periodoFimUsar,
                      produto_id: produto.id,
                      cliente_id: cliente.id,
                      tarefa_id: tarefa.originalId || (typeof tarefa.id === 'string' && tarefa.id.includes('_') ? tarefa.id.split('_')[0] : tarefa.id)
                    })
                  });

                  if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                      const tempoMs = extrairTempoRealizadoMs(result);
                      novosTemposTarefa[tarefaKey] = tempoMs;
                      // Fallback simples
                      novosTemposTarefa[tarefaKeyAlt] = tempoMs;
                    }
                  }
                } catch (err) { console.error(err); }
              }));
            }));
          }));
        });

        const resultados = await Promise.all(promisesResponsaveis);
        await Promise.all(promisesNested);

        resultados.forEach(({ responsavelId, tempoRealizado }) => {
          novosTempos[responsavelId] = tempoRealizado;
        });

        setTemposRealizadosPorResponsavel(novosTempos);
        setTemposRealizadosPorProduto(novosTemposProduto);
        setTemposRealizadosPorCliente(novosTemposCliente);
        setTemposRealizadosPorTarefa(novosTemposTarefa);
      } else if (tipo === 'clientes') {
        const novosTempos = {};

        // Para clientes, buscar tempo realizado de todos os responsáveis relacionados
        const responsaveisUnicos = new Set();
        dados.registros.forEach(cliente => {
          if (cliente.registros && Array.isArray(cliente.registros)) {
            cliente.registros.forEach(reg => {
              if (reg.responsavel_id) {
                responsaveisUnicos.add(reg.responsavel_id);
              }
            });
          }
        });

        // Buscar tempo realizado para cada cliente
        const promises = dados.registros.map(async (cliente) => {
          let tempoTotal = 0;
          const promisesResponsaveis = Array.from(responsaveisUnicos).map(async (responsavelId) => {
            try {
              const response = await fetch('/api/registro-tempo/realizado-total', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  responsavel_id: responsavelId,
                  data_inicio: periodoInicioUsar,
                  data_fim: periodoFimUsar,
                  tarefa_id: filtrosAdicionais?.tarefa_id || null,
                  cliente_id: cliente.id,
                  produto_id: filtrosAdicionais?.produto_id || null
                })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                  return extrairTempoRealizadoMs(result);
                }
              }
              return 0;
            } catch (error) {
              console.error('Erro ao buscar tempo realizado do cliente:', error);
              return 0;
            }
          });

          const resultados = await Promise.all(promisesResponsaveis);
          tempoTotal = resultados.reduce((sum, tempo) => sum + tempo, 0);

          // Usar cliente.id como string para consistência
          const clienteIdStr = String(cliente.id || '');
          return { clienteId: clienteIdStr, tempoRealizado: tempoTotal };
        });

        const resultados = await Promise.all(promises);
        resultados.forEach(({ clienteId, tempoRealizado }) => {
          novosTempos[clienteId] = tempoRealizado;
        });

        setTemposRealizadosPorCliente(novosTempos);

        // Calcular tempo realizado por tarefa dentro de cada cliente
        const temposPorTarefaPorCliente = {};
        const promisesTarefas = dados.registros.map(async (cliente) => {
          // Usar cliente.id como string diretamente (mesma lógica do cálculo de tempo total por cliente linha 284)
          const clienteIdStr = String(cliente.id || '');

          if (!cliente.tarefas || !Array.isArray(cliente.tarefas) || cliente.tarefas.length === 0) {
            return { clienteId: clienteIdStr, temposPorTarefa: {} };
          }

          const temposPorTarefa = {};
          const tarefasPromises = cliente.tarefas.map(async (tarefa) => {
            // Coletar responsáveis únicos desta tarefa específica (igual ao tipo 'tarefas' linha ~139-146)
            const responsaveisUnicosTarefa = new Set();
            if (tarefa.registros && Array.isArray(tarefa.registros)) {
              tarefa.registros.forEach(reg => {
                if (reg.responsavel_id) {
                  responsaveisUnicosTarefa.add(reg.responsavel_id);
                }
              });
            }

            if (responsaveisUnicosTarefa.size === 0) {
              return { tarefaId: String(tarefa.id), tempoRealizado: 0 };
            }

            let tempoTotalTarefa = 0;
            // Usar responsaveisUnicosTarefa ao invés de responsaveisUnicos do nível de cliente
            const promisesResponsaveisTarefa = Array.from(responsaveisUnicosTarefa).map(async (responsavelId) => {
              try {
                const tarefaIdReal = tarefa.originalId || (typeof tarefa.id === 'string' && tarefa.id.includes('_') ? tarefa.id.split('_')[0] : tarefa.id);

                const response = await fetch('/api/registro-tempo/realizado-total', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    responsavel_id: responsavelId,
                    data_inicio: periodoInicioUsar,
                    data_fim: periodoFimUsar,
                    tarefa_id: tarefaIdReal,
                    cliente_id: cliente.id,
                    produto_id: filtrosAdicionais?.produto_id || null
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  if (result.success && result.data) {
                    return extrairTempoRealizadoMs(result);
                  }
                }
                return 0;
              } catch (error) {
                console.error('Erro ao buscar tempo realizado da tarefa dentro do cliente:', error);
                return 0;
              }
            });

            const resultadosTarefa = await Promise.all(promisesResponsaveisTarefa);
            tempoTotalTarefa = resultadosTarefa.reduce((sum, tempo) => sum + tempo, 0);

            return { tarefaId: String(tarefa.id), tempoRealizado: tempoTotalTarefa };
          });

          const resultadosTarefas = await Promise.all(tarefasPromises);
          resultadosTarefas.forEach(({ tarefaId, tempoRealizado }) => {
            temposPorTarefa[tarefaId] = tempoRealizado;
          });

          return { clienteId: clienteIdStr, temposPorTarefa };
        });

        const resultadosTarefasPorCliente = await Promise.all(promisesTarefas);
        resultadosTarefasPorCliente.forEach(({ clienteId, temposPorTarefa }) => {
          temposPorTarefaPorCliente[clienteId] = temposPorTarefa;
        });

        setTemposRealizadosPorTarefaPorCliente(temposPorTarefaPorCliente);
      } else if (tipo === 'produtos') {
        const novosTempos = {};

        // Para produtos, buscar tempo realizado de todos os responsáveis relacionados
        // Se há filtro de responsável nos filtrosAdicionais OU entidadeId é um responsável, usar apenas esse responsável
        const responsaveisUnicos = new Set();

        // Se há responsavel_id nos filtrosAdicionais, usar apenas esse
        if (filtrosAdicionais?.responsavel_id) {
          const responsavelIds = Array.isArray(filtrosAdicionais.responsavel_id)
            ? filtrosAdicionais.responsavel_id
            : [filtrosAdicionais.responsavel_id];
          responsavelIds.forEach(id => {
            if (id) responsaveisUnicos.add(id);
          });
        } else {
          // Caso contrário, coletar de todos os registros (igual à lógica de clientes)
          dados.registros.forEach(produto => {
            if (produto.registros && Array.isArray(produto.registros)) {
              produto.registros.forEach(reg => {
                if (reg.responsavel_id) {
                  responsaveisUnicos.add(reg.responsavel_id);
                }
              });
            }
          });

          // Se não encontrou nenhum responsável nos registros e há entidadeId, pode ser que o filtro principal seja responsavel
          // Nesse caso, usar o entidadeId como responsável
          if (responsaveisUnicos.size === 0 && entidadeId) {
            console.log(`⚠️ [DETAIL-SIDE-CARD] Nenhum responsável encontrado nos registros, usando entidadeId como fallback: ${entidadeId}`);
            responsaveisUnicos.add(entidadeId);
          }
        }

        // Buscar tempo realizado para cada produto (EXATAMENTE igual à lógica de clientes)
        const promises = dados.registros.map(async (produto) => {
          let tempoTotal = 0;
          const promisesResponsaveis = Array.from(responsaveisUnicos).map(async (responsavelId) => {
            try {
              const response = await fetch('/api/registro-tempo/realizado-total', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  responsavel_id: responsavelId,
                  data_inicio: periodoInicioUsar,
                  data_fim: periodoFimUsar,
                  tarefa_id: filtrosAdicionais?.tarefa_id || null,
                  cliente_id: (filtrosAdicionais?.cliente_id ?? (tipo === 'produtos' ? entidadeId : null)) || null,
                  produto_id: parseInt(String(produto.id).trim(), 10) || null
                })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                  return extrairTempoRealizadoMs(result);
                }
              }
              return 0;
            } catch (error) {
              console.error('Erro ao buscar tempo realizado do produto:', error);
              return 0;
            }
          });

          const resultados = await Promise.all(promisesResponsaveis);
          tempoTotal = resultados.reduce((sum, tempo) => sum + tempo, 0);

          // Usar produto.id como string para consistência (igual à lógica de clientes)
          const produtoIdStr = String(produto.id || '');
          return { produtoId: produtoIdStr, tempoRealizado: tempoTotal };
        });

        const resultados = await Promise.all(promises);
        resultados.forEach(({ produtoId, tempoRealizado }) => {
          novosTempos[produtoId] = tempoRealizado;
        });
        // Não setar temposRealizadosPorProduto aqui; será preenchido por agregação bottom-up abaixo

        // Calcular tempo realizado por cliente dentro de cada produto
        const temposPorClientePorProduto = {};
        // Calcular tempo realizado por tarefa dentro de cada cliente dentro de cada produto
        const temposPorTarefaPorClientePorProduto = {};

        const promisesProdutosHierarquicos = dados.registros.map(async (produto) => {
          const produtoIdNormalizado = String(produto.id);
          const temposPorCliente = {};
          const temposPorTarefaPorCliente = {};
          const temClientesNaArvore = produto.clientes && Array.isArray(produto.clientes) && produto.clientes.length > 0;

          if (!temClientesNaArvore) {
            // Produto sem clientes na árvore: derivar a partir de produto.registros (tarefas únicas) para manter valor correto
            if (produto.registros && Array.isArray(produto.registros) && produto.registros.length > 0) {
              const tarefasUnicas = new Map();
              produto.registros.forEach(reg => {
                if (!reg.tarefa_id) return;
                const compKey = `${reg.tarefa_id}_${reg.cliente_id || 'sem_cliente'}_${reg.produto_id || 'sem_produto'}`;
                if (!tarefasUnicas.has(compKey)) {
                  tarefasUnicas.set(compKey, { id: compKey, originalId: String(reg.tarefa_id), responsavel_id: reg.responsavel_id });
                }
              });
              const chaveVirtualCliente = '_produto_sem_cliente_';
              temposPorTarefaPorCliente[chaveVirtualCliente] = {};
              for (const [, tarefa] of tarefasUnicas) {
                let tempoTotalTarefa = 0;
                const responsaveisTarefa = new Set();
                if (tarefa.responsavel_id) responsaveisTarefa.add(tarefa.responsavel_id);
                if (responsaveisTarefa.size === 0) responsaveisUnicos.forEach(r => responsaveisTarefa.add(r));
                const promisesResp = Array.from(responsaveisTarefa).map(async (responsavelId) => {
                  try {
                    const tarefaIdReal = tarefa.originalId ?? (String(tarefa.id).includes('_') ? String(tarefa.id).split('_')[0] : tarefa.id);
                    const response = await fetch('/api/registro-tempo/realizado-total', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        responsavel_id: responsavelId,
                        data_inicio: periodoInicioUsar,
                        data_fim: periodoFimUsar,
                        tarefa_id: tarefaIdReal,
                        cliente_id: (filtrosAdicionais?.cliente_id ?? (tipo === 'produtos' ? entidadeId : null)) || null,
                        produto_id: parseInt(String(produto.id).trim(), 10) || null
                      })
                    });
                    if (response.ok) {
                      const result = await response.json();
                      return result.success ? extrairTempoRealizadoMs(result) : 0;
                    }
                    return 0;
                  } catch (e) { return 0; }
                });
                const resultados = await Promise.all(promisesResp);
                tempoTotalTarefa = resultados.reduce((s, t) => s + t, 0);
                temposPorTarefaPorCliente[chaveVirtualCliente][tarefa.id] = tempoTotalTarefa;
              }
            }
            return { produtoId: produtoIdNormalizado, temposPorCliente, temposPorTarefaPorCliente };
          }

          const clientesPromises = produto.clientes.map(async (cliente) => {
            // Garantir que clienteIdNormalizado nunca seja null - usar cliente.id como fallback
            let clienteIdNormalizado = normalizarClienteId(cliente);
            if (!clienteIdNormalizado && cliente.id) {
              clienteIdNormalizado = String(cliente.id);
            }
            // Se ainda for null, usar cliente.id diretamente
            if (!clienteIdNormalizado) {
              clienteIdNormalizado = cliente.id ? String(cliente.id) : 'unknown';
            }
            // Calcular tempo realizado por cliente dentro do produto
            let tempoTotalCliente = 0;
            const promisesResponsaveisCliente = Array.from(responsaveisUnicos).map(async (responsavelId) => {
              try {
                const response = await fetch('/api/registro-tempo/realizado-total', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    responsavel_id: responsavelId,
                    data_inicio: periodoInicioUsar,
                    data_fim: periodoFimUsar,
                    tarefa_id: filtrosAdicionais?.tarefa_id || null,
                    cliente_id: cliente.id,
                    produto_id: parseInt(String(produto.id).trim(), 10) || null
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  if (result.success && result.data) {
                    return extrairTempoRealizadoMs(result);
                  }
                }
                return 0;
              } catch (error) {
                console.error('Erro ao buscar tempo realizado do cliente dentro do produto:', error);
                return 0;
              }
            });

            const resultadosCliente = await Promise.all(promisesResponsaveisCliente);
            tempoTotalCliente = resultadosCliente.reduce((sum, tempo) => sum + tempo, 0);

            // Calcular tempo realizado por tarefa dentro deste cliente dentro deste produto
            const temposPorTarefa = {};
            if (cliente.tarefas && Array.isArray(cliente.tarefas) && cliente.tarefas.length > 0) {
              const tarefasPromises = cliente.tarefas.map(async (tarefa) => {
                // Coletar responsáveis únicos desta tarefa específica (igual ao tipo 'tarefas' linha ~139-146)
                const responsaveisUnicosTarefa = new Set();
                if (tarefa.registros && Array.isArray(tarefa.registros)) {
                  tarefa.registros.forEach(reg => {
                    if (reg.responsavel_id) {
                      responsaveisUnicosTarefa.add(reg.responsavel_id);
                    }
                  });
                }

                // Se a tarefa não tem registros próprios, usar responsáveis do nível superior (produto) como fallback
                if (responsaveisUnicosTarefa.size === 0 && responsaveisUnicos.size > 0) {
                  responsaveisUnicos.forEach(respId => responsaveisUnicosTarefa.add(respId));
                }

                if (responsaveisUnicosTarefa.size === 0) {
                  return { tarefaId: tarefa.id, tempoRealizado: 0 };
                }

                // Buscar tempo realizado para cada responsável e somar — mesmo endpoint/payload do tipo 'tarefas'
                // para retornar o tempo realizado total da tarefa (4min 1s), sem filtrar por cliente/produto
                let tempoTotalTarefa = 0;
                const promisesResponsaveisTarefa = Array.from(responsaveisUnicosTarefa).map(async (responsavelId) => {
                  try {
                    const tarefaIdReal = tarefa.originalId ?? (typeof tarefa.id === 'string' && tarefa.id.includes('_') ? tarefa.id.split('_')[0] : tarefa.id);

                    const response = await fetch('/api/registro-tempo/realizado-total', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        responsavel_id: responsavelId,
                        data_inicio: periodoInicioUsar,
                        data_fim: periodoFimUsar,
                        tarefa_id: tarefaIdReal,
                        cliente_id: cliente.id,
                        produto_id: parseInt(String(produto.id).trim(), 10) || null
                      })
                    });

                    if (response.ok) {
                      const result = await response.json();
                      if (result.success && result.data) {
                        return extrairTempoRealizadoMs(result);
                      }
                    }
                    return 0;
                  } catch (error) {
                    console.error('Erro ao buscar tempo realizado da tarefa dentro do cliente dentro do produto:', error);
                    return 0;
                  }
                });

                const resultadosTarefa = await Promise.all(promisesResponsaveisTarefa);
                tempoTotalTarefa = resultadosTarefa.reduce((sum, tempo) => sum + tempo, 0);

                // Retornar tarefaId sem converter para string (igual ao tipo 'tarefas')
                return { tarefaId: tarefa.id, tempoRealizado: tempoTotalTarefa };
              });

              const resultadosTarefas = await Promise.all(tarefasPromises);
              resultadosTarefas.forEach(({ tarefaId, tempoRealizado }) => {
                // Armazenar com múltiplas variações de chaves para garantir correspondência
                const tarefaIdStr = String(tarefaId);

                // Armazenar com tarefaId como string
                temposPorTarefa[tarefaIdStr] = tempoRealizado;

                // Também armazenar com o ID original se for diferente (number)
                if (typeof tarefaId !== 'string') {
                  temposPorTarefa[tarefaId] = tempoRealizado;
                }
              });
            }

            return {
              clienteId: clienteIdNormalizado,
              tempoRealizado: tempoTotalCliente,
              temposPorTarefa
            };
          });

          const resultadosClientes = await Promise.all(clientesPromises);
          resultadosClientes.forEach((resultado, index) => {
            const { clienteId, tempoRealizado, temposPorTarefa } = resultado;
            const cliente = produto.clientes[index];

            // Armazenar com múltiplas variações de clienteId para garantir correspondência
            // Usar clienteId normalizado
            temposPorCliente[clienteId] = tempoRealizado;
            temposPorTarefaPorCliente[clienteId] = temposPorTarefa;

            // Também armazenar com cliente.id original se diferente
            if (cliente && cliente.id) {
              const clienteIdOriginal = String(cliente.id);
              if (clienteIdOriginal !== clienteId) {
                temposPorCliente[clienteIdOriginal] = tempoRealizado;
                temposPorTarefaPorCliente[clienteIdOriginal] = temposPorTarefa;
              }

              // Também armazenar com cliente.id como number se for diferente
              if (typeof cliente.id !== 'string' && String(cliente.id) !== clienteId) {
                temposPorCliente[cliente.id] = tempoRealizado;
                temposPorTarefaPorCliente[cliente.id] = temposPorTarefa;
              }
            }
          });

          return {
            produtoId: produtoIdNormalizado,
            temposPorCliente,
            temposPorTarefaPorCliente
          };
        });

        const resultadosProdutosHierarquicos = await Promise.all(promisesProdutosHierarquicos);
        resultadosProdutosHierarquicos.forEach(({ produtoId, temposPorCliente, temposPorTarefaPorCliente }) => {
          temposPorClientePorProduto[produtoId] = { ...temposPorCliente };
          temposPorTarefaPorClientePorProduto[produtoId] = temposPorTarefaPorCliente;
        });

        // Agregação bottom-up: cliente = soma das tarefas; produto = soma dos clientes (consistente com registros)
        const temposRealizadosPorProdutoDerivados = {};
        Object.keys(temposPorTarefaPorClientePorProduto).forEach(produtoId => {
          const temposPorTarefaPorCliente = temposPorTarefaPorClientePorProduto[produtoId];
          if (!temposPorClientePorProduto[produtoId]) temposPorClientePorProduto[produtoId] = {};
          let somaProduto = 0;
          Object.keys(temposPorTarefaPorCliente).forEach(clienteId => {
            const temposTarefas = temposPorTarefaPorCliente[clienteId];
            const somaCliente = typeof temposTarefas === 'object' && temposTarefas !== null
              ? Object.values(temposTarefas).reduce((s, v) => s + (Number(v) || 0), 0)
              : 0;
            temposPorClientePorProduto[produtoId][clienteId] = somaCliente;
            somaProduto += somaCliente;
          });
          temposRealizadosPorProdutoDerivados[produtoId] = somaProduto;
        });
        // Produtos sem clientes (sem filhos): manter valor da API do primeiro bloco. Não sobrescrever quando o produto tem clientes (valor derivado já é a soma correta).
        Object.keys(novosTempos).forEach(produtoId => {
          const temposPorTarefaPorCliente = temposPorTarefaPorClientePorProduto[produtoId] || {};
          const temClientes = Object.keys(temposPorTarefaPorCliente).length > 0;
          if (temposRealizadosPorProdutoDerivados[produtoId] === undefined || (!temClientes && (novosTempos[produtoId] || 0) > 0)) {
            temposRealizadosPorProdutoDerivados[produtoId] = novosTempos[produtoId] || 0;
          }
        });

        setTemposRealizadosPorProduto(temposRealizadosPorProdutoDerivados);
        setTemposRealizadosPorClientePorProduto(temposPorClientePorProduto);
        setTemposRealizadosPorTarefaPorClientePorProduto(temposPorTarefaPorClientePorProduto);
      } else if (tipo === 'tipos_tarefa') {
        const novosTemposTipo = {};
        const novosTemposTarefaPorTipo = {};

        // Para cada tipo de tarefa
        const promises = dados.registros.map(async (tipoTarefa) => {
          let tempoTotalTipo = 0;
          const temposPorTarefa = {};

          if (tipoTarefa.registros && Array.isArray(tipoTarefa.registros)) {
            // Coletar responsáveis únicos
            const responsaveisUnicos = new Set();
            tipoTarefa.registros.forEach(reg => {
              if (reg.responsavel_id) responsaveisUnicos.add(reg.responsavel_id);
            });

            // Buscar tempo realizado total do tipo de tarefa
            const promisesResponsaveis = Array.from(responsaveisUnicos).map(async (responsavelId) => {
              try {
                const response = await fetch('/api/registro-tempo/realizado-total', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    responsavel_id: responsavelId,
                    data_inicio: periodoInicioUsar,
                    data_fim: periodoFimUsar,
                    tipo_tarefa_id: tipoTarefa.id,
                    cliente_id: filtrosAdicionais?.cliente_id || null,
                    produto_id: filtrosAdicionais?.produto_id || null
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  if (result.success && result.data) {
                    return extrairTempoRealizadoMs(result);
                  }
                }
                return 0;
              } catch (error) {
                console.error('Erro ao buscar tempo realizado do tipo de tarefa:', error);
                return 0;
              }
            });

            const resultadosTipo = await Promise.all(promisesResponsaveis);
            tempoTotalTipo = resultadosTipo.reduce((sum, t) => sum + t, 0);

            // Calcular tempo por tarefa dentro deste tipo
            // Para simplificar e garantir precisão, vamos agrupar os registros que já temos
            // ou buscar do backend se necessário. O buscarDetalhesPorTipo já agrupou os registros.

            // NOVO: Se tivermos registros, podemos estimar ou buscar por tarefa_id
            const tarefasNoTipo = new Set();
            tipoTarefa.registros.forEach(reg => {
              if (reg.tarefa_id) tarefasNoTipo.add(reg.tarefa_id);
            });

            const tarefasPromises = Array.from(tarefasNoTipo).map(async (tarefaId) => {
              let tempoTarefa = 0;
              const promisesRespTarefa = Array.from(responsaveisUnicos).map(async (responsavelId) => {
                try {
                  const response = await fetch('/api/registro-tempo/realizado-total', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      responsavel_id: responsavelId,
                      data_inicio: periodoInicioUsar,
                      data_fim: periodoFimUsar,
                      tarefa_id: tarefaId,
                      tipo_tarefa_id: tipoTarefa.id
                    })
                  });
                  if (response.ok) {
                    const result = await response.json();
                    return result.success ? extrairTempoRealizadoMs(result) : 0;
                  }
                  return 0;
                } catch (e) { return 0; }
              });
              const resultadosRespTarefa = await Promise.all(promisesRespTarefa);
              tempoTarefa = resultadosRespTarefa.reduce((sum, t) => sum + t, 0);
              return { tarefaId: String(tarefaId), tempoRealizado: tempoTarefa };
            });

            const resultadosTarefas = await Promise.all(tarefasPromises);
            resultadosTarefas.forEach(({ tarefaId, tempoRealizado }) => {
              temposPorTarefa[tarefaId] = tempoRealizado;
            });
          }

          return { tipoId: String(tipoTarefa.id), tempoRealizado: tempoTotalTipo, temposPorTarefa };
        });

        const resultados = await Promise.all(promises);
        resultados.forEach(({ tipoId, tempoRealizado, temposPorTarefa }) => {
          novosTemposTipo[tipoId] = tempoRealizado;
          novosTemposTarefaPorTipo[tipoId] = temposPorTarefa;
        });

        setTemposRealizadosPorTipoTarefa(novosTemposTipo);
        setTemposRealizadosPorTarefaPorTipoTarefa(novosTemposTarefaPorTipo);
      }
    };

    buscarTemposRealizados();
  }, [tipo, dados, periodoInicio, periodoFim, filtrosAdicionais]);

  useEffect(() => {
    // Fechar ao clicar fora
    const handleClickOutside = (event) => {
      const card = cardRef.current;
      if (card && !card.contains(event.target) && !event.target.closest('.resumo-arrow')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Aplicar animação após montagem (apenas uma vez)
  useEffect(() => {
    const card = cardRef.current;
    if (card) {
      requestAnimationFrame(() => {
        card.style.opacity = '1';
        if (position) {
          card.style.transform = 'scale(1)';
        } else {
          card.style.transform = 'translate(-50%, -50%) scale(1)';
        }
      });
    }
  }, [position]); // Apenas quando position muda (abre/fecha), não em scroll

  // Buscar registros individuais de tempo realizado para uma tarefa
  // (tarefa, clienteId, produtoIdOpcional) — produtoIdOpcional: quando a tarefa está sob Produto > Cliente > Tarefa, passar o produto.id para o total dos registros bater com o realizado exibido na tarefa
  const buscarRegistrosIndividuais = async (tarefa, clienteId, produtoIdOpcional) => {
    const storageKey = (tipo === 'tarefas' || tipo === 'responsaveis' || tipo === 'produtos') && clienteId ? `${tarefa.id}-${clienteId}` : tarefa.id;
    if (registrosIndividuais[storageKey] || carregandoRegistros[storageKey]) {
      return; // Já carregado ou carregando
    }

    setCarregandoRegistros(prev => ({ ...prev, [storageKey]: true }));

    try {
      // Caminho: tipo clientes/tarefas/responsaveis/produtos e tarefa sem registros — buscar por GET registro-tempo (cliente_id, tarefa_id, período; produto_id quando card de produto ou quando passado pelo contexto da árvore)
      const registrosVazios = !tarefa.registros || !Array.isArray(tarefa.registros) || tarefa.registros.length === 0;
      const usaBuscaPorClienteTarefa = (tipo === 'clientes' || tipo === 'tarefas' || tipo === 'responsaveis' || tipo === 'produtos') && registrosVazios && clienteId && periodoInicio && periodoFim;
      if (usaBuscaPorClienteTarefa) {
        const tarefaIdReal = tarefa.originalId ?? tarefa.original_id ?? (typeof tarefa.id === 'string' && tarefa.id !== 'sem_tarefa' ? tarefa.id : tarefa.id);
        if (tarefaIdReal && tarefaIdReal !== 'sem_tarefa') {
          const params = new URLSearchParams();
          params.append('cliente_id', String(clienteId));
          params.append('tarefa_id', String(tarefaIdReal));
          params.append('data_inicio', typeof periodoInicio === 'string' ? periodoInicio.split('T')[0] : (periodoInicio instanceof Date ? periodoInicio.toISOString().split('T')[0] : String(periodoInicio).split('T')[0]));
          params.append('data_fim', typeof periodoFim === 'string' ? periodoFim.split('T')[0] : (periodoFim instanceof Date ? periodoFim.toISOString().split('T')[0] : String(periodoFim).split('T')[0]));
          // produto_id: do contexto da árvore (produtoIdOpcional) ou do card quando o card é de produto — assim o total dos registros bate com o realizado exibido na tarefa
          const produtoIdParaFiltro = produtoIdOpcional ?? (cardTipo === 'produto' && entidadeId ? entidadeId : null);
          if (produtoIdParaFiltro) {
            params.append('produto_id', String(produtoIdParaFiltro));
          }
          params.append('limit', '500');
          const response = await fetch(`${API_BASE_URL}/registro-tempo?${params.toString()}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
              const registros = result.data.map(r => ({
                ...r,
                tempo_realizado: r.tempo_realizado || (r.data_inicio && r.data_fim ? (new Date(r.data_fim).getTime() - new Date(r.data_inicio).getTime()) : 0)
              }));
              registros.sort((a, b) => {
                const dataA = a.data_inicio ? new Date(a.data_inicio).getTime() : 0;
                const dataB = b.data_inicio ? new Date(b.data_inicio).getTime() : 0;
                return dataB - dataA;
              });
              setRegistrosIndividuais(prev => ({ ...prev, [storageKey]: registros }));
            } else {
              setRegistrosIndividuais(prev => ({ ...prev, [storageKey]: [] }));
            }
          } else {
            setRegistrosIndividuais(prev => ({ ...prev, [storageKey]: [] }));
          }
        } else {
          setRegistrosIndividuais(prev => ({ ...prev, [storageKey]: [] }));
        }
        setCarregandoRegistros(prev => {
          const novo = { ...prev };
          delete novo[storageKey];
          return novo;
        });
        return;
      }

      // Coletar todos os tempo_estimado_ids dos registros desta tarefa
      const tempoEstimadoIds = (tarefa.registros || [])
        .map(reg => reg.id || reg.tempo_estimado_id)
        .filter(Boolean);

      if (tempoEstimadoIds.length === 0) {
        setRegistrosIndividuais(prev => ({ ...prev, [tarefa.id]: [] }));
        setCarregandoRegistros(prev => {
          const novo = { ...prev };
          delete novo[tarefa.id];
          return novo;
        });
        return;
      }

      // Criar mapa de tempo_estimado_id -> responsavelId a partir dos registros da tarefa
      const responsavelIdMap = new Map();
      tarefa.registros.forEach(reg => {
        const tempoEstimadoId = String(reg.id || reg.tempo_estimado_id || '');
        if (tempoEstimadoId && reg.responsavel_id) {
          responsavelIdMap.set(tempoEstimadoId, reg.responsavel_id);
        }
      });

      // Buscar registros individuais para cada registro estimado (usando ID ou critérios)
      const promises = tarefa.registros.map(async (reg) => {
        try {
          const tempoEstimadoId = reg.id || reg.tempo_estimado_id;

          // Extrair ID real da tarefa para garantir busca correta
          const tarefaIdReal = tarefa.originalId || (typeof tarefa.id === 'string' && tarefa.id.includes('_') ? tarefa.id.split('_')[0] : tarefa.id);

          const params = new URLSearchParams();

          // 1. Usuario ID (Responsável)
          if (reg.responsavel_id) {
            params.append('usuario_id', reg.responsavel_id);
            // Também enviar responsavel_id explicitamente para que o backend possa converter para usuario_id real
            params.append('responsavel_id', reg.responsavel_id);
          }

          // 2. Tarefa ID (Real/Limpo)
          if (tarefaIdReal || reg.tarefa_id) {
            params.append('tarefa_id', tarefaIdReal || reg.tarefa_id);
          }

          // 3. Cliente ID
          if (reg.cliente_id) {
            params.append('cliente_id', reg.cliente_id);
          }

          // 4. Data
          if (reg.data) {
            const dataStr = typeof reg.data === 'string' ? reg.data.split('T')[0] : (reg.data instanceof Date ? reg.data.toISOString().split('T')[0] : null);
            if (dataStr) {
              params.append('data', dataStr);
            }
          }

          // Manter tempo_estimado_id apenas como fallback ou referência secundária
          if (tempoEstimadoId) {
            params.append('tempo_estimado_id', tempoEstimadoId);
          }

          console.log('[DEBUG_INDIVIDUAL] Buscando registros (igual PainelUsuario):', params.toString());

          const response = await fetch(`${API_BASE_URL}/registro-tempo/por-tempo-estimado?${params.toString()}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
              // Obter responsavelId
              const responsavelId = reg.responsavel_id || tarefa.responsavelId || null;

              return result.data.map(r => ({
                ...r,
                tempo_estimado_id: tempoEstimadoId,
                responsavelId: responsavelId,
                tempo_realizado: r.tempo_realizado || (r.data_inicio && r.data_fim
                  ? (new Date(r.data_fim).getTime() - new Date(r.data_inicio).getTime())
                  : 0)
              }));
            }
          }
          return [];
        } catch (error) {
          console.error('Erro ao buscar registros individuais:', error);
          return [];
        }
      });

      const resultados = await Promise.all(promises);
      const registros = resultados.flat();

      // Ordenar por data_inicio (mais recente primeiro)
      registros.sort((a, b) => {
        const dataA = a.data_inicio ? new Date(a.data_inicio).getTime() : 0;
        const dataB = b.data_inicio ? new Date(b.data_inicio).getTime() : 0;
        return dataB - dataA; // Ordem decrescente (mais recente primeiro)
      });

      setRegistrosIndividuais(prev => ({ ...prev, [tarefa.id]: registros }));
    } catch (error) {
      console.error('Erro ao buscar registros individuais:', error);
      setRegistrosIndividuais(prev => ({ ...prev, [tarefa.id]: [] }));
    } finally {
      setCarregandoRegistros(prev => {
        const novo = { ...prev };
        delete novo[tarefa.id];
        return novo;
      });
    }
  };

  // OTIMIZAÇÃO OTIMISTA: Não retornamos null se dados estiver vazio.
  // Renderizamos o card vazio/loading para feedback visual imediato.

  // Garantir que dados existe minimamente
  const registros = dados?.registros || [];
  const isLoading = dados?.loading || false;

  const tipoLabels = {
    tarefas: { label: 'Tarefas', icon: 'fa-list', color: '#4b5563' },
    produtos: { label: 'Produtos', icon: 'fa-box', color: '#4b5563' },
    clientes: { label: 'Clientes', icon: 'fa-briefcase', color: '#4b5563' },
    responsaveis: { label: 'Responsáveis', icon: 'fa-user-tie', color: '#4b5563' },
    tipos_tarefa: { label: 'Tipos de Tarefa', icon: 'fa-tags', color: '#4b5563' }
  };

  const tipoInfo = tipoLabels[tipo] || { label: tipo, icon: 'fa-info-circle', color: '#4b5563' };

  // Calcular posição - estilo igual ao servidor original
  let cardStyle = {
    position: 'absolute',
    width: '500px',
    minWidth: '420px',
    maxWidth: '560px',
    maxHeight: '75vh',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
    zIndex: 2000,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    opacity: 0,
    transform: 'scale(0.95)',
    transition: 'opacity 0.2s ease, transform 0.2s ease'
  };

  if (position) {
    cardStyle.left = position.left;
    cardStyle.top = position.top;
    cardStyle.position = 'absolute';
  } else {
    // Se não houver posição, centralizar na tela
    cardStyle.left = '50%';
    cardStyle.top = '50%';
    cardStyle.position = 'fixed';
    cardStyle.transform = 'translate(-50%, -50%) scale(0.95)';
  }



  // Se for tarefas, clientes, produtos ou responsáveis, os dados já vêm agrupados com tempo realizado total e registros
  // Para outros tipos, agrupar por nome (para mostrar apenas uma vez cada item)
  const itensLista = (tipo === 'tarefas' || tipo === 'clientes' || tipo === 'produtos' || tipo === 'responsaveis' || tipo === 'tipos_tarefa')
    ? registros
    : (() => {
      const itensUnicos = {};
      registros.forEach(reg => {
        const chave = reg.nome || `${reg.tipo}_${reg.id || reg.tarefa_id || reg.produto_id || reg.cliente_id || reg.responsavel_id}`;
        if (!itensUnicos[chave]) {
          itensUnicos[chave] = {
            nome: reg.nome || chave,
            tipo: reg.tipo,
            id: reg.id || reg.tarefa_id || reg.produto_id || reg.cliente_id || reg.responsavel_id
          };
        }
      });
      return Object.values(itensUnicos);
    })();

  const toggleTarefa = (tarefaId) => {
    setTarefasExpandidas(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(tarefaId)) {
        newExpanded.delete(tarefaId);
      } else {
        newExpanded.add(tarefaId);
        // Buscar registros individuais quando expandir
        const tarefa = dados.registros.find(t => t.id === tarefaId);
        if (tarefa) {
          buscarRegistrosIndividuais(tarefa);
        }
      }
      return newExpanded;
    });
  };

  const toggleTipoTarefa = (tipoId) => {
    setTiposTarefaExpandidos(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(tipoId)) {
        newExpanded.delete(tipoId);
      } else {
        newExpanded.add(tipoId);
      }
      return newExpanded;
    });
  };

  const cardContent = (
    <div ref={cardRef} className="detail-side-card" style={cardStyle}>
      <div className="detail-side-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className={`fas ${tipoInfo.icon}`} style={{ color: tipoInfo.color }}></i>
          <h3>{tipoInfo.label}</h3>
        </div>
        <button className="detail-side-card-close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="detail-side-card-body">
        <div className="detail-side-card-list">
          {isLoading && itensLista.length === 0 ? (
            <div className="loading-state" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Carregando detalhes...
            </div>
          ) : itensLista.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum item encontrado</p>
            </div>
          ) : tipo === 'tarefas' ? (
            <TarefasDetalhadasList
              tarefas={itensLista}
              tarefasExpandidas={tarefasExpandidas}
              registrosIndividuais={registrosIndividuais}
              carregandoRegistros={carregandoRegistros}
              formatarTempoEstimado={formatarTempoEstimado}
              calcularCustoPorTempo={calcularCustoPorTempo}
              formatarValorMonetario={formatarValorMonetario}
              formatarDataHora={formatarDataHora}
              formatarTempoHMS={formatarTempoHMS}
              onToggleTarefa={toggleTarefa}
              buscarRegistrosIndividuais={buscarRegistrosIndividuais}
              getNomeCliente={getNomeCliente}
              getNomeColaboradorPorUsuarioId={getNomeColaboradorPorUsuarioId}
              getNomeTipoTarefa={getNomeTipoTarefa}
              temposRealizadosPorTarefa={temposRealizadosPorTarefa}
              filtrosAdicionais={filtrosAdicionais}
            />
          ) : (tipo === 'clientes' || tipo === 'produtos' || tipo === 'responsaveis') ? (
            <DetalhesFlatList
              items={itensLista}
              formatarTempoHMS={formatarTempoHMS}
            />
          ) : tipo === 'tipos_tarefa' ? (
            <TiposTarefaDetalhadosList
              tiposTarefa={itensLista}
              tiposTarefaExpandidos={tiposTarefaExpandidos}
              registrosIndividuais={registrosIndividuais}
              carregandoRegistros={carregandoRegistros}
              formatarTempoEstimado={formatarTempoEstimado}
              calcularCustoPorTempo={calcularCustoPorTempo}
              formatarValorMonetario={formatarValorMonetario}
              formatarDataHora={formatarDataHora}
              formatarTempoHMS={formatarTempoHMS}
              onToggleTipoTarefa={toggleTipoTarefa}
              buscarRegistrosIndividuais={buscarRegistrosIndividuais}
              getNomeColaboradorPorUsuarioId={getNomeColaboradorPorUsuarioId}
              getNomeTipoTarefa={getNomeTipoTarefa}
              temposRealizadosPorTipoTarefa={temposRealizadosPorTipoTarefa}
              temposRealizadosPorTarefaPorTipoTarefa={temposRealizadosPorTarefaPorTipoTarefa}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {itensLista.map((item, index) => (
                <li
                  key={`${item.tipo}_${item.id}_${index}`}
                  style={{
                    padding: '8px 12px',
                    borderBottom: index < itensLista.length - 1 ? '1px solid #e5e7eb' : 'none',
                    fontSize: '13px',
                    color: '#334155'
                  }}
                >
                  {item.nome}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  // Renderizar usando portal para garantir posicionamento correto
  return createPortal(cardContent, document.body);
};

export default DetailSideCard;
