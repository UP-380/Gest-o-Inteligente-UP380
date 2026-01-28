import React, { useState, useEffect } from 'react';
import './TarefasDetalhadasList.css';

/**
 * Componente para listar produtos detalhados com tempo estimado, realizado, custos, clientes e tarefas
 * 
 * @param {Object} props
 * @param {Array} props.produtos - Array de produtos com tempo realizado, estimado, custo, clientes e tarefas
 * @param {Set} props.produtosExpandidos - Set com IDs dos produtos expandidos
 * @param {Object} props.registrosIndividuais - Objeto com registros individuais por tarefa ID
 * @param {Object} props.carregandoRegistros - Objeto com estado de carregamento por tarefa ID
 * @param {Function} props.formatarTempoEstimado - Função para formatar tempo estimado
 * @param {Function} props.calcularCustoPorTempo - Função para calcular custo por tempo
 * @param {Function} props.formatarValorMonetario - Função para formatar valor monetário
 * @param {Function} props.formatarDataHora - Função para formatar data e hora
 * @param {Function} props.formatarTempoHMS - Função para formatar tempo em HMS
 * @param {Function} props.onToggleProduto - Função chamada ao clicar no botão de expandir/colapsar produto
 * @param {Function} props.buscarRegistrosIndividuais - Função para buscar registros individuais de uma tarefa
 * @param {Object} props.temposRealizadosPorProduto - Objeto com tempos realizados por produto ID (chave: produtoId, valor: tempoEmMs)
 * @param {Object} props.temposRealizadosPorClientePorProduto - Objeto com tempos realizados por cliente dentro de cada produto (chave: produtoId, valor: { [clienteId]: tempoEmMs })
 * @param {Object} props.temposRealizadosPorTarefaPorClientePorProduto - Objeto com tempos realizados por tarefa dentro de cada cliente dentro de cada produto (chave: produtoId, valor: { [clienteId]: { [tarefaId]: tempoEmMs } })
 * @param {String} props.periodoInicio - Data de início do período (opcional, para busca direta)
 * @param {String} props.periodoFim - Data de fim do período (opcional, para busca direta)
 * @param {Object} props.filtrosAdicionais - Filtros adicionais (opcional, para busca direta)
 */
const ProdutosDetalhadosList = ({
  produtos,
  produtosExpandidos,
  registrosIndividuais,
  carregandoRegistros,
  formatarTempoEstimado,
  calcularCustoPorTempo,
  formatarValorMonetario,
  formatarDataHora,
  formatarTempoHMS,
  onToggleProduto,
  buscarRegistrosIndividuais,
  getNomeColaboradorPorUsuarioId = null,
  temposRealizadosPorProduto = {},
  temposRealizadosPorClientePorProduto = {},
  temposRealizadosPorTarefaPorClientePorProduto = {},
  periodoInicio = null,
  periodoFim = null,
  filtrosAdicionais = null
}) => {
  const [clientesExpandidos, setClientesExpandidos] = useState(new Set());
  const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());
  const [responsaveisExpandidos, setResponsaveisExpandidos] = useState(new Set());
  const [temposRealizadosPorTarefa, setTemposRealizadosPorTarefa] = useState({}); // Buscar diretamente igual ao TarefasDetalhadasList

  const toggleResponsavel = (tarefaId, dataNormalizada, responsavelKey) => {
    const key = `${tarefaId}_${dataNormalizada}_${responsavelKey}`;
    setResponsaveisExpandidos(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
      }
      return newExpanded;
    });
  };

  // Buscar tempos realizados diretamente para TODAS as tarefas (igual ao TarefasDetalhadasList)
  useEffect(() => {
    if (!periodoInicio || !periodoFim || !produtos || produtos.length === 0) return;

    // Coletar TODAS as tarefas de todos os produtos e clientes
    const todasTarefas = [];
    produtos.forEach(produto => {
      if (produto.clientes && Array.isArray(produto.clientes)) {
        produto.clientes.forEach(cliente => {
          if (cliente.tarefas && Array.isArray(cliente.tarefas)) {
            cliente.tarefas.forEach(tarefa => {
              todasTarefas.push({ tarefa, cliente, produto });
            });
          }
        });
      }
    });

    if (todasTarefas.length === 0) return;

    // Buscar tempos realizados diretamente (EXATAMENTE igual ao TarefasDetalhadasList)
    const buscarTemposRealizados = async () => {
      // Regra 1: Bloqueio imediato se solicitado globalmente
      if (window.blockDetailedFetches) {
        return;
      }

      const novosTempos = {};
      let abortadoPorErro = false;

      // Regra 2: Batching de tarefas (lotes de 2 para reduzir carga massiva)
      const batchSizeTarefas = 2;
      for (let i = 0; i < todasTarefas.length; i += batchSizeTarefas) {
        if (abortadoPorErro) break;

        const batchTarefas = todasTarefas.slice(i, i + batchSizeTarefas);

        await Promise.all(batchTarefas.map(async ({ tarefa, cliente, produto }) => {
          // Coletar responsáveis únicos desta tarefa
          const responsaveisUnicos = new Set();
          if (tarefa.registros && Array.isArray(tarefa.registros)) {
            tarefa.registros.forEach(reg => {
              if (reg.responsavel_id) responsaveisUnicos.add(reg.responsavel_id);
            });
          }

          if (responsaveisUnicos.size === 0) {
            novosTempos[tarefa.id] = 0;
            return;
          }

          // Regra 2: Batching de responsáveis dentro da tarefa
          let tempoTotal = 0;
          const responsaveisIds = Array.from(responsaveisUnicos);
          const batchSizeResponsaveis = 2;

          for (let j = 0; j < responsaveisIds.length; j += batchSizeResponsaveis) {
            if (abortadoPorErro) break;
            const batchRes = responsaveisIds.slice(j, j + batchSizeResponsaveis);

            const resultados = await Promise.all(batchRes.map(async (responsavelId) => {
              try {
                const response = await fetch('/api/registro-tempo/realizado-total', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    responsavel_id: responsavelId,
                    data_inicio: periodoInicio,
                    data_fim: periodoFim,
                    tarefa_id: tarefa.id,
                    cliente_id: cliente.id || null,
                    produto_id: produto.id || null
                  })
                });

                // Regra 5: Tratar 503 como fallback silencioso e abortar
                if (response.status === 503) {
                  console.warn(`[ProdutosDetalhadosList] Servidor sobrecarregado (503) para tarefa ${tarefa.id}. Abortando.`);
                  abortadoPorErro = true;
                  return 0;
                }

                if (response.ok) {
                  const result = await response.json();
                  return result.success && result.data ? result.data.tempo_realizado_ms || 0 : 0;
                }
                return 0;
              } catch (error) {
                console.error('Erro ao buscar tempo realizado da tarefa:', error);
                return 0;
              }
            }));

            tempoTotal += resultados.reduce((sum, v) => sum + v, 0);
          }

          novosTempos[tarefa.id] = tempoTotal;
        }));
      }

      setTemposRealizadosPorTarefa(novosTempos);
    };

    buscarTemposRealizados();
  }, [produtos, periodoInicio, periodoFim]);

  if (!produtos || produtos.length === 0) {
    return (
      <div className="tarefas-detalhadas-empty">
        <p>Nenhum produto encontrado</p>
      </div>
    );
  }

  const toggleCliente = (produtoId, clienteId) => {
    const key = `${produtoId}-${clienteId}`;
    setClientesExpandidos(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
      }
      return newExpanded;
    });
  };

  const toggleTarefa = (produtoId, clienteId, tarefaId, tarefa) => {
    const key = `${produtoId}-${clienteId}-${tarefaId}`;
    setTarefasExpandidas(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
        // Buscar registros individuais quando expandir
        if (buscarRegistrosIndividuais && tarefa) {
          buscarRegistrosIndividuais(tarefa);
        }
      }
      return newExpanded;
    });
  };

  return (
    <div className="tarefas-detalhadas-list">
      {produtos.map((produto, produtoIndex) => {
        const isProdutoExpanded = produtosExpandidos.has(produto.id);
        // Buscar tempo realizado do prop ou usar 0 como padrão (tentar ambas as chaves como em clientes)
        const produtoIdStr = String(produto.id || '');
        const tempoRealizadoMs = temposRealizadosPorProduto[produtoIdStr]
          || temposRealizadosPorProduto[produto.id]
          || temposRealizadosPorProduto[String(produto.id)]
          || produto.tempoRealizado || 0;
        const tempoRealizadoFormatado = formatarTempoHMS
          ? formatarTempoHMS(tempoRealizadoMs)
          : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoMs, true) : '0s');

        const tempoEstimadoFormatado = formatarTempoEstimado
          ? formatarTempoEstimado(produto.tempoEstimado || 0, true)
          : '0s';

        // Calcular custo estimado
        const custoEstimado = produto.responsavelId && calcularCustoPorTempo && formatarValorMonetario
          ? calcularCustoPorTempo(produto.tempoEstimado || 0, produto.responsavelId)
          : null;

        return (
          <div
            key={`produto_${produto.id}_${produtoIndex}`}
            className="tarefa-detalhada-card tarefa-detalhada-card-nivel-1"
          >
            <div className="tarefa-detalhada-header">
              <div className="tarefa-detalhada-info">
                <div className="tarefa-detalhada-nome">
                  <i className="fas fa-box" style={{ marginRight: '8px' }}></i>
                  {produto.nome}
                </div>
                <div className="tarefa-detalhada-metrics">
                  {/* Card Estimado */}
                  <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado">
                    <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-estimado">
                      <i className="fas fa-clock"></i>
                      <span>ESTIMADO</span>
                    </div>
                    <div className="tarefa-detalhada-tempo-card-content">
                      <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                        {tempoEstimadoFormatado}
                      </div>
                      {custoEstimado !== null && formatarValorMonetario && (
                        <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                          {formatarValorMonetario(custoEstimado)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Realizado */}
                  <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado">
                    <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-realizado">
                      <i className="fas fa-stopwatch"></i>
                      <span>REALIZADO</span>
                    </div>
                    <div className="tarefa-detalhada-tempo-card-content">
                      <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                        {tempoRealizadoFormatado}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {(produto.clientes && produto.clientes.length > 0) || (produto.tarefas && produto.tarefas.length > 0) ? (
                <button
                  className="tarefa-detalhada-toggle"
                  onClick={() => onToggleProduto(produto.id)}
                  title={isProdutoExpanded ? (produto.clientes ? "Ocultar clientes" : "Ocultar tarefas") : (produto.clientes ? "Ver clientes" : "Ver tarefas")}
                >
                  <i
                    className={`fas fa-chevron-down ${isProdutoExpanded ? 'expanded' : ''}`}
                  ></i>
                </button>
              ) : null}
            </div>
            {isProdutoExpanded && produto.clientes && produto.clientes.length > 0 && (
              <div className="tarefa-detalhada-registros">
                <div className="tarefa-detalhada-registros-title">
                  Clientes ({produto.clientes.length}):
                </div>
                <div className="tarefa-detalhada-cliente-tarefas">
                  {produto.clientes.map((cliente, clienteIndex) => {
                    const clienteKey = `${produto.id}-${cliente.id}`;
                    const isClienteExpanded = clientesExpandidos.has(clienteKey);
                    // Buscar tempo realizado do prop ou usar fallback (garantir que IDs sejam strings)
                    const produtoIdStr = String(produto.id);
                    const clienteIdStr = String(cliente.id);
                    // Normalizar clienteId usando mesma lógica do ClientesDetalhadosList
                    const clienteIdCalculado = cliente.id || (cliente.nome && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(cliente.nome)) ? cliente.nome : null);
                    const clienteIdNormalizado = clienteIdCalculado ? String(clienteIdCalculado) : clienteIdStr;
                    // Tentar múltiplas variações de chave para garantir correspondência
                    const tempoRealizadoClienteMs = temposRealizadosPorClientePorProduto?.[produtoIdStr]?.[clienteIdNormalizado]
                      || temposRealizadosPorClientePorProduto?.[produtoIdStr]?.[clienteIdCalculado]
                      || temposRealizadosPorClientePorProduto?.[produtoIdStr]?.[clienteIdStr]
                      || temposRealizadosPorClientePorProduto?.[produto.id]?.[cliente.id]
                      || temposRealizadosPorClientePorProduto?.[produtoIdStr]?.[cliente.id]
                      || temposRealizadosPorClientePorProduto?.[String(produto.id)]?.[clienteIdNormalizado]
                      || cliente.tempoRealizado || 0;
                    const tempoRealizadoClienteFormatado = formatarTempoHMS
                      ? formatarTempoHMS(tempoRealizadoClienteMs)
                      : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoClienteMs, true) : '0s');

                    const tempoEstimadoClienteFormatado = formatarTempoEstimado
                      ? formatarTempoEstimado(cliente.tempoEstimado || 0, true)
                      : '0s';

                    // Calcular custo estimado do cliente
                    const custoEstimadoCliente = produto.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                      ? calcularCustoPorTempo(cliente.tempoEstimado || 0, produto.responsavelId)
                      : null;

                    return (
                      <div
                        key={`cliente_${cliente.id}_${clienteIndex}`}
                        className="tarefa-detalhada-card tarefa-detalhada-card-nivel-2"
                        style={{ marginTop: '8px' }}
                      >
                        <div className="tarefa-detalhada-header">
                          <div className="tarefa-detalhada-info">
                            <div className="tarefa-detalhada-nome">
                              <i className="fas fa-building" style={{ marginRight: '8px' }}></i>
                              {cliente.nome}
                            </div>
                            <div className="tarefa-detalhada-metrics">
                              {/* Card Estimado do Cliente */}
                              <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado tarefa-detalhada-tempo-card-dia">
                                <div className="tarefa-detalhada-tempo-card-content">
                                  <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '10px' }}></i>
                                  <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                    {tempoEstimadoClienteFormatado}
                                  </div>
                                  {custoEstimadoCliente !== null && formatarValorMonetario && (
                                    <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                      {formatarValorMonetario(custoEstimadoCliente)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Card Realizado do Cliente */}
                              <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado tarefa-detalhada-tempo-card-dia">
                                <div className="tarefa-detalhada-tempo-card-content">
                                  <i className="fas fa-stopwatch" style={{ color: '#fd7e14', fontSize: '10px' }}></i>
                                  <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                                    {tempoRealizadoClienteFormatado}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {cliente.tarefas && cliente.tarefas.length > 0 && (
                            <button
                              className="tarefa-detalhada-toggle"
                              onClick={() => toggleCliente(produto.id, cliente.id)}
                              title={isClienteExpanded ? "Ocultar tarefas" : "Ver tarefas"}
                            >
                              <i
                                className={`fas fa-chevron-down ${isClienteExpanded ? 'expanded' : ''}`}
                              ></i>
                            </button>
                          )}
                        </div>
                        {isClienteExpanded && cliente.tarefas && cliente.tarefas.length > 0 && (
                          <div className="tarefa-detalhada-registros">
                            <div className="tarefa-detalhada-registros-title">
                              Tarefas ({cliente.tarefas.length}):
                            </div>
                            <div className="tarefa-detalhada-cliente-tarefas">
                              {cliente.tarefas.map((tarefa, tarefaIndex) => {
                                const tarefaKey = `${produto.id}-${cliente.id}-${tarefa.id}`;
                                const isTarefaExpanded = tarefasExpandidas.has(tarefaKey);
                                // Buscar tempo realizado do prop hierárquico ou usar fallback (garantir que IDs sejam strings)
                                const produtoIdStr = String(produto.id);
                                const clienteIdStr = String(cliente.id);
                                const tarefaIdStr = String(tarefa.id);
                                // Normalizar clienteId usando mesma lógica
                                const clienteIdCalculado = cliente.id || (cliente.nome && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(cliente.nome)) ? cliente.nome : null);
                                const clienteIdNormalizado = clienteIdCalculado ? String(clienteIdCalculado) : clienteIdStr;
                                // Buscar tempo realizado diretamente (igual ao TarefasDetalhadasList)
                                // Usar temposRealizadosPorTarefa que busca diretamente do endpoint
                                // Buscar tempo realizado diretamente (igual ao TarefasDetalhadasList)
                                // Usar temposRealizadosPorTarefa que busca diretamente do endpoint
                                let tempoRealizadoTarefaMs = temposRealizadosPorTarefa[tarefa.id] || tarefa.tempoRealizado || 0;

                                // Fallback: se for 0 e tivermos registros, somar deles
                                const registrosDaTarefa = registrosIndividuais[tarefa.id];
                                if ((!tempoRealizadoTarefaMs || tempoRealizadoTarefaMs === 0) && registrosDaTarefa && registrosDaTarefa.length > 0) {
                                  tempoRealizadoTarefaMs = registrosDaTarefa.reduce((total, reg) => {
                                    let tempoReg = Number(reg.tempo_realizado) || 0;
                                    if (tempoReg > 0 && tempoReg < 1) tempoReg = Math.round(tempoReg * 3600000);
                                    if (tempoReg > 0 && tempoReg < 1000) tempoReg = 1000;
                                    return total + tempoReg;
                                  }, 0);
                                }
                                const tempoRealizadoTarefaFormatado = formatarTempoHMS
                                  ? formatarTempoHMS(tempoRealizadoTarefaMs)
                                  : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoTarefaMs, true) : '0s');

                                const tempoEstimadoTarefaFormatado = formatarTempoEstimado
                                  ? formatarTempoEstimado(tarefa.tempoEstimado || 0, true)
                                  : '0s';

                                // Calcular custo realizado da tarefa (usar tempoRealizadoTarefaMs que já foi buscado)
                                const custoRealizadoTarefa = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                  ? calcularCustoPorTempo(tempoRealizadoTarefaMs, tarefa.responsavelId)
                                  : null;

                                // Calcular custo estimado da tarefa
                                const custoEstimadoTarefa = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                  ? calcularCustoPorTempo(tarefa.tempoEstimado || 0, tarefa.responsavelId)
                                  : null;

                                return (
                                  <div
                                    key={`tarefa_${tarefa.id}_${tarefaIndex}`}
                                    className="tarefa-detalhada-card tarefa-detalhada-card-nivel-3"
                                    style={{ marginTop: '8px' }}
                                  >
                                    <div className="tarefa-detalhada-header">
                                      <div className="tarefa-detalhada-info">
                                        <div className="tarefa-detalhada-nome">
                                          <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
                                          {tarefa.nome}
                                        </div>
                                        <div className="tarefa-detalhada-metrics">
                                          {/* Card Estimado da Tarefa */}
                                          <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado tarefa-detalhada-tempo-card-dia">
                                            <div className="tarefa-detalhada-tempo-card-content">
                                              <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '10px' }}></i>
                                              <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                                {tempoEstimadoTarefaFormatado}
                                              </div>
                                              {custoEstimadoTarefa !== null && formatarValorMonetario && (
                                                <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                                  {formatarValorMonetario(custoEstimadoTarefa)}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Card Realizado da Tarefa */}
                                          <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado tarefa-detalhada-tempo-card-dia">
                                            <div className="tarefa-detalhada-tempo-card-content">
                                              <i className="fas fa-stopwatch" style={{ color: '#fd7e14', fontSize: '10px' }}></i>
                                              <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                                                {tempoRealizadoTarefaFormatado}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      {tarefa.registros && tarefa.registros.length > 0 && (
                                        <button
                                          className="tarefa-detalhada-toggle"
                                          onClick={() => toggleTarefa(produto.id, cliente.id, tarefa.id, tarefa)}
                                          title={isTarefaExpanded ? "Ocultar registros" : "Ver registros"}
                                        >
                                          <i
                                            className={`fas fa-chevron-down ${isTarefaExpanded ? 'expanded' : ''}`}
                                          ></i>
                                        </button>
                                      )}
                                    </div>
                                    {isTarefaExpanded && (
                                      <div className="tarefa-detalhada-registros">
                                        <div className="tarefa-detalhada-registros-title">
                                          Registros de Tempo Realizado:
                                        </div>
                                        {carregandoRegistros[tarefa.id] ? (
                                          <div className="tarefa-detalhada-loading">
                                            <i className="fas fa-spinner fa-spin"></i>
                                            <span>Carregando...</span>
                                          </div>
                                        ) : (() => {
                                          const registros = registrosIndividuais[tarefa.id] || [];
                                          if (registros.length === 0) {
                                            return (
                                              <div className="tarefa-detalhada-empty-registros">
                                                Nenhum registro individual encontrado
                                              </div>
                                            );
                                          }

                                          // Função para normalizar data (apenas data, sem hora)
                                          const normalizarData = (dataInput) => {
                                            if (!dataInput) return null;
                                            try {
                                              const date = new Date(dataInput);
                                              if (isNaN(date.getTime())) return null;
                                              const ano = date.getFullYear();
                                              const mes = String(date.getMonth() + 1).padStart(2, '0');
                                              const dia = String(date.getDate()).padStart(2, '0');
                                              return `${ano}-${mes}-${dia}`;
                                            } catch (e) {
                                              return null;
                                            }
                                          };

                                          // Função para formatar data para exibição (DD/MM/YYYY)
                                          const formatarDataExibicao = (dataStr) => {
                                            if (!dataStr) return '—';
                                            try {
                                              const [ano, mes, dia] = dataStr.split('-');
                                              return `${dia}/${mes}/${ano}`;
                                            } catch (e) {
                                              return dataStr;
                                            }
                                          };

                                          // Agrupar registros por data
                                          const registrosPorData = new Map();

                                          registros.forEach(registro => {
                                            const dataInicio = registro.data_inicio || registro.created_at || registro.data;
                                            const dataNormalizada = normalizarData(dataInicio);

                                            if (!dataNormalizada) return;

                                            if (!registrosPorData.has(dataNormalizada)) {
                                              registrosPorData.set(dataNormalizada, {
                                                data: dataNormalizada,
                                                registros: [],
                                                tempoRealizadoTotal: 0
                                              });
                                            }

                                            const grupoData = registrosPorData.get(dataNormalizada);
                                            // Tempo realizado sempre 0 (lógica removida)
                                            grupoData.registros.push(registro);
                                          });

                                          // Buscar tempo estimado por data nos registros da tarefa
                                          const tempoEstimadoPorData = new Map();
                                          if (tarefa.registros && Array.isArray(tarefa.registros)) {
                                            tarefa.registros.forEach(reg => {
                                              const dataReg = reg.data || reg.data_inicio || reg.created_at;
                                              const dataNormalizada = normalizarData(dataReg);

                                              if (dataNormalizada) {
                                                const tempoEstimadoDia = reg.tempo_estimado_dia || 0;
                                                if (!tempoEstimadoPorData.has(dataNormalizada)) {
                                                  tempoEstimadoPorData.set(dataNormalizada, 0);
                                                }
                                                tempoEstimadoPorData.set(
                                                  dataNormalizada,
                                                  tempoEstimadoPorData.get(dataNormalizada) + tempoEstimadoDia
                                                );
                                              }
                                            });
                                          }

                                          // Ordenar datas (mais recente primeiro)
                                          const datasOrdenadas = Array.from(registrosPorData.keys()).sort((a, b) => {
                                            return new Date(b).getTime() - new Date(a).getTime();
                                          });

                                          return (
                                            <div className="tarefa-detalhada-registros-list">
                                              {datasOrdenadas.map((dataNormalizada) => {
                                                const grupoData = registrosPorData.get(dataNormalizada);
                                                const tempoEstimadoDia = tempoEstimadoPorData.get(dataNormalizada) || 0;
                                                // Calcular sumatória do dia
                                                let tempoRealizadoDia = 0;
                                                grupoData.registros.forEach(reg => {
                                                  let tempoReg = Number(reg.tempo_realizado) || 0;
                                                  if (tempoReg > 0 && tempoReg < 1) tempoReg = Math.round(tempoReg * 3600000);
                                                  if (tempoReg > 0 && tempoReg < 1000) tempoReg = 1000;
                                                  tempoRealizadoDia += tempoReg;
                                                });

                                                const tempoEstimadoFormatado = formatarTempoEstimado
                                                  ? formatarTempoEstimado(tempoEstimadoDia, true)
                                                  : '0s';

                                                const tempoRealizadoFormatado = formatarTempoEstimado
                                                  ? formatarTempoEstimado(tempoRealizadoDia, true)
                                                  : '0s';

                                                // Calcular custos
                                                const custoEstimadoDia = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                                  ? calcularCustoPorTempo(tempoEstimadoDia, tarefa.responsavelId)
                                                  : null;

                                                const custoRealizadoDia = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                                  ? calcularCustoPorTempo(tempoRealizadoDia, tarefa.responsavelId)
                                                  : null;

                                                return (
                                                  <div
                                                    key={`data_${tarefa.id}_${dataNormalizada}`}
                                                    className="tarefa-detalhada-data-group"
                                                  >
                                                    <div className="tarefa-detalhada-data-header">
                                                      <div className="tarefa-detalhada-data-label">
                                                        {formatarDataExibicao(dataNormalizada)}
                                                      </div>
                                                      <div className="tarefa-detalhada-data-metrics">
                                                        {/* Card Estimado do Dia */}
                                                        {tempoEstimadoDia > 0 && (
                                                          <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado tarefa-detalhada-tempo-card-dia">
                                                            <div className="tarefa-detalhada-tempo-card-content">
                                                              <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '10px' }}></i>
                                                              <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                                                {tempoEstimadoFormatado}
                                                              </div>
                                                              {custoEstimadoDia !== null && formatarValorMonetario && (
                                                                <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                                                  {formatarValorMonetario(custoEstimadoDia)}
                                                                </div>
                                                              )}
                                                            </div>
                                                          </div>
                                                        )}

                                                        {/* Card Realizado do Dia */}
                                                        <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado tarefa-detalhada-tempo-card-dia">
                                                          <div className="tarefa-detalhada-tempo-card-content">
                                                            <i className="fas fa-stopwatch" style={{ color: '#fd7e14', fontSize: '10px' }}></i>
                                                            <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                                                              {tempoRealizadoFormatado}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Lista de registros individuais da data - Agrupados por responsável */}
                                                    {grupoData.registros.length > 0 && (() => {
                                                      // Agrupar registros por responsável
                                                      const registrosPorResponsavel = new Map();

                                                      grupoData.registros.forEach((registro) => {
                                                        const responsavelId = registro.usuario_id || registro.membro?.id || 'desconhecido';
                                                        let nomeResponsavel = registro.membro?.nome;

                                                        // Se não encontrou no registro.membro, buscar usando a função
                                                        if (!nomeResponsavel && getNomeColaboradorPorUsuarioId && responsavelId !== 'desconhecido') {
                                                          nomeResponsavel = getNomeColaboradorPorUsuarioId(responsavelId);
                                                        }

                                                        // Fallback para caso não encontre
                                                        if (!nomeResponsavel) {
                                                          nomeResponsavel = `Colaborador #${responsavelId}`;
                                                        }

                                                        const responsavelKey = String(responsavelId);

                                                        if (!registrosPorResponsavel.has(responsavelKey)) {
                                                          registrosPorResponsavel.set(responsavelKey, {
                                                            nome: nomeResponsavel,
                                                            registros: []
                                                          });
                                                        }

                                                        registrosPorResponsavel.get(responsavelKey).registros.push(registro);
                                                      });

                                                      return (
                                                        <div className="tarefa-detalhada-registros-individuais">
                                                          {Array.from(registrosPorResponsavel.entries()).map(([responsavelKey, grupoResponsavel]) => {
                                                            // Calcular tempo total do responsável
                                                            let tempoTotalResponsavel = 0;
                                                            grupoResponsavel.registros.forEach(reg => {
                                                              let tempoReg = Number(reg.tempo_realizado) || 0;
                                                              // Converter horas decimais para milissegundos se necessário
                                                              if (tempoReg > 0 && tempoReg < 1) {
                                                                tempoReg = Math.round(tempoReg * 3600000);
                                                              }
                                                              // Se resultado < 1 segundo, arredondar para 1 segundo
                                                              if (tempoReg > 0 && tempoReg < 1000) {
                                                                tempoReg = 1000;
                                                              }
                                                              tempoTotalResponsavel += tempoReg;
                                                            });

                                                            const tempoTotalFormatado = formatarTempoEstimado
                                                              ? formatarTempoEstimado(tempoTotalResponsavel, true)
                                                              : formatarTempoHMS(tempoTotalResponsavel);

                                                            // Calcular custo total do responsável
                                                            const custoTotalResponsavel = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                                              ? calcularCustoPorTempo(tempoTotalResponsavel, responsavelKey)
                                                              : null;

                                                            const responsavelKeyFull = `${tarefa.id}_${dataNormalizada}_${responsavelKey}`;
                                                            const isResponsavelExpanded = responsaveisExpandidos.has(responsavelKeyFull);

                                                            return (
                                                              <div key={`responsavel_${tarefa.id}_${dataNormalizada}_${responsavelKey}`} className="tarefa-detalhada-responsavel-group">
                                                                <div className="tarefa-detalhada-responsavel-header">
                                                                  <div className="tarefa-detalhada-responsavel-nome-wrapper">
                                                                    <i className="fas fa-user" style={{ color: '#6b7280', fontSize: '13px' }}></i>
                                                                    <span className="tarefa-detalhada-responsavel-nome">{grupoResponsavel.nome}</span>
                                                                  </div>
                                                                  <button
                                                                    className="tarefa-detalhada-responsavel-toggle"
                                                                    onClick={() => toggleResponsavel(tarefa.id, dataNormalizada, responsavelKey)}
                                                                    title={isResponsavelExpanded ? "Ocultar registros" : "Ver registros"}
                                                                  >
                                                                    <i
                                                                      className={`fas fa-chevron-down ${isResponsavelExpanded ? 'expanded' : ''}`}
                                                                      style={{
                                                                        color: '#1e3a8a',
                                                                        fontSize: '12px',
                                                                        transform: isResponsavelExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                        transition: 'transform 0.2s'
                                                                      }}
                                                                    ></i>
                                                                  </button>
                                                                </div>
                                                                {isResponsavelExpanded && (
                                                                  <div className="tarefa-detalhada-responsavel-registros">
                                                                    {grupoResponsavel.registros.map((registro, regIdx) => {
                                                                      const tempoRealizadoReg = registro.tempo_realizado || 0;
                                                                      // Converter horas decimais para milissegundos se necessário
                                                                      let tempoMs = tempoRealizadoReg;
                                                                      if (tempoRealizadoReg > 0 && tempoRealizadoReg < 1) {
                                                                        tempoMs = Math.round(tempoRealizadoReg * 3600000);
                                                                      }
                                                                      // Se resultado < 1 segundo, arredondar para 1 segundo
                                                                      if (tempoMs > 0 && tempoMs < 1000) {
                                                                        tempoMs = 1000;
                                                                      }

                                                                      const tempoRealizadoFormatado = formatarTempoEstimado
                                                                        ? formatarTempoEstimado(tempoMs, true)
                                                                        : formatarTempoHMS(tempoMs);

                                                                      const tempoDecimal = (tempoMs / 3600000).toFixed(2);

                                                                      // Formatar data e hora completa
                                                                      const dataFormatada = formatarDataHora(registro.data_inicio || registro.created_at || registro.data);

                                                                      return (
                                                                        <div
                                                                          key={`reg_${tarefa.id}_${dataNormalizada}_${responsavelKey}_${regIdx}_${registro.id || regIdx}`}
                                                                          className="tarefa-detalhada-registro-item-simples"
                                                                        >
                                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <i className="fas fa-stopwatch" style={{ color: '#94a3b8' }}></i>
                                                                            <span
                                                                              className="tarefa-detalhada-registro-tempo-badge"
                                                                              title={`${tempoDecimal}h`}
                                                                            >
                                                                              {tempoRealizadoFormatado}
                                                                            </span>
                                                                          </div>
                                                                          {dataFormatada !== '—' && (
                                                                            <div style={{ color: '#6b7280' }}>{dataFormatada}</div>
                                                                          )}
                                                                        </div>
                                                                      );
                                                                    })}
                                                                  </div>
                                                                )}
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
                                                      );
                                                    })()}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Se não há clientes mas há tarefas (filtro pai é cliente), renderizar tarefas diretamente */}
            {isProdutoExpanded && (!produto.clientes || produto.clientes.length === 0) && produto.tarefas && produto.tarefas.length > 0 && (
              <div className="tarefa-detalhada-registros">
                <div className="tarefa-detalhada-registros-title">
                  Tarefas ({produto.tarefas.length}):
                </div>
                <div className="tarefa-detalhada-cliente-tarefas">
                  {produto.tarefas.map((tarefa, tarefaIndex) => {
                    const tarefaKey = `${produto.id}-${tarefa.id}`;
                    const isTarefaExpanded = tarefasExpandidas.has(tarefaKey);
                    // Buscar tempo realizado diretamente (igual ao TarefasDetalhadasList)
                    // Buscar tempo realizado diretamente (igual ao TarefasDetalhadasList)
                    let tempoRealizadoTarefaMs = temposRealizadosPorTarefa[tarefa.id] || tarefa.tempoRealizado || 0;

                    // Fallback: se for 0 e tivermos registros, somar deles
                    const registrosDaTarefa = registrosIndividuais[tarefa.id];
                    if ((!tempoRealizadoTarefaMs || tempoRealizadoTarefaMs === 0) && registrosDaTarefa && registrosDaTarefa.length > 0) {
                      tempoRealizadoTarefaMs = registrosDaTarefa.reduce((total, reg) => {
                        let tempoReg = Number(reg.tempo_realizado) || 0;
                        if (tempoReg > 0 && tempoReg < 1) tempoReg = Math.round(tempoReg * 3600000);
                        if (tempoReg > 0 && tempoReg < 1000) tempoReg = 1000;
                        return total + tempoReg;
                      }, 0);
                    }
                    const tempoRealizadoTarefaFormatado = formatarTempoHMS
                      ? formatarTempoHMS(tempoRealizadoTarefaMs)
                      : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoTarefaMs, true) : '0s');

                    const tempoEstimadoTarefaFormatado = formatarTempoEstimado
                      ? formatarTempoEstimado(tarefa.tempoEstimado || 0, true)
                      : '0s';

                    // Calcular custo realizado da tarefa
                    const custoRealizadoTarefa = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                      ? calcularCustoPorTempo(tempoRealizadoTarefaMs, tarefa.responsavelId)
                      : null;

                    // Calcular custo estimado da tarefa
                    const custoEstimadoTarefa = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                      ? calcularCustoPorTempo(tarefa.tempoEstimado || 0, tarefa.responsavelId)
                      : null;

                    return (
                      <div
                        key={`tarefa_${tarefa.id}_${tarefaIndex}`}
                        className="tarefa-detalhada-card tarefa-detalhada-card-nivel-2"
                        style={{ marginTop: '8px' }}
                      >
                        <div className="tarefa-detalhada-header">
                          <div className="tarefa-detalhada-info">
                            <div className="tarefa-detalhada-nome">
                              <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
                              {tarefa.nome}
                            </div>
                            <div className="tarefa-detalhada-metrics">
                              {/* Card Estimado da Tarefa */}
                              <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado tarefa-detalhada-tempo-card-dia">
                                <div className="tarefa-detalhada-tempo-card-content">
                                  <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '10px' }}></i>
                                  <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                    {tempoEstimadoTarefaFormatado}
                                  </div>
                                  {custoEstimadoTarefa !== null && formatarValorMonetario && (
                                    <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                      {formatarValorMonetario(custoEstimadoTarefa)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Card Realizado da Tarefa */}
                              <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado tarefa-detalhada-tempo-card-dia">
                                <div className="tarefa-detalhada-tempo-card-content">
                                  <i className="fas fa-stopwatch" style={{ color: '#fd7e14', fontSize: '10px' }}></i>
                                  <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                                    {tempoRealizadoTarefaFormatado}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {(() => {
                            const registrosTarefa = registrosIndividuais[tarefa.id] || [];
                            return registrosTarefa.length > 0 ? (
                              <button
                                className="tarefa-detalhada-toggle"
                                onClick={() => toggleTarefa(produto.id, null, tarefa.id, tarefa)}
                                title={isTarefaExpanded ? "Ocultar registros" : "Ver registros"}
                              >
                                <i
                                  className={`fas fa-chevron-down ${isTarefaExpanded ? 'expanded' : ''}`}
                                ></i>
                              </button>
                            ) : null;
                          })()}
                        </div>
                        {isTarefaExpanded && (() => {
                          const registrosTarefa = registrosIndividuais[tarefa.id] || [];
                          if (registrosTarefa.length === 0) return null;

                          // Agrupar registros por data
                          const registrosPorData = new Map();
                          const normalizarData = (dataInput) => {
                            if (!dataInput) return null;
                            try {
                              const date = new Date(dataInput);
                              if (isNaN(date.getTime())) return null;
                              return date.toISOString().split('T')[0];
                            } catch (e) {
                              return null;
                            }
                          };

                          const formatarDataExibicao = (dataStr) => {
                            try {
                              const date = new Date(dataStr);
                              return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            } catch (e) {
                              return dataStr;
                            }
                          };

                          registrosTarefa.forEach((registro) => {
                            const dataReg = registro.data || registro.data_inicio || registro.created_at;
                            const dataNormalizada = normalizarData(dataReg);

                            if (dataNormalizada) {
                              if (!registrosPorData.has(dataNormalizada)) {
                                registrosPorData.set(dataNormalizada, {
                                  registros: [],
                                  tempoRealizadoTotal: 0
                                });
                              }

                              const grupoData = registrosPorData.get(dataNormalizada);
                              // Tempo realizado sempre 0 (lógica removida)
                              grupoData.registros.push(registro);
                            }
                          });

                          // Buscar tempo estimado por data nos registros da tarefa
                          const tempoEstimadoPorData = new Map();
                          if (tarefa.registros && Array.isArray(tarefa.registros)) {
                            tarefa.registros.forEach(reg => {
                              const dataReg = reg.data || reg.data_inicio || reg.created_at;
                              const dataNormalizada = normalizarData(dataReg);

                              if (dataNormalizada) {
                                const tempoEstimadoDia = reg.tempo_estimado_dia || 0;
                                if (!tempoEstimadoPorData.has(dataNormalizada)) {
                                  tempoEstimadoPorData.set(dataNormalizada, 0);
                                }
                                tempoEstimadoPorData.set(
                                  dataNormalizada,
                                  tempoEstimadoPorData.get(dataNormalizada) + tempoEstimadoDia
                                );
                              }
                            });
                          }

                          // Ordenar datas (mais recente primeiro)
                          const datasOrdenadas = Array.from(registrosPorData.keys()).sort((a, b) => {
                            return new Date(b).getTime() - new Date(a).getTime();
                          });

                          return (
                            <div className="tarefa-detalhada-registros-list">
                              {datasOrdenadas.map((dataNormalizada) => {
                                const grupoData = registrosPorData.get(dataNormalizada);
                                const tempoEstimadoDia = tempoEstimadoPorData.get(dataNormalizada) || 0;
                                // Calcular sumatória do dia
                                let tempoRealizadoDia = 0;
                                grupoData.registros.forEach(reg => {
                                  let tempoReg = Number(reg.tempo_realizado) || 0;
                                  if (tempoReg > 0 && tempoReg < 1) tempoReg = Math.round(tempoReg * 3600000);
                                  if (tempoReg > 0 && tempoReg < 1000) tempoReg = 1000;
                                  tempoRealizadoDia += tempoReg;
                                });

                                const tempoEstimadoFormatado = formatarTempoEstimado
                                  ? formatarTempoEstimado(tempoEstimadoDia, true)
                                  : '0s';

                                const tempoRealizadoFormatado = formatarTempoEstimado
                                  ? formatarTempoEstimado(tempoRealizadoDia, true)
                                  : '0s';

                                // Calcular custos
                                const custoEstimadoDia = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                  ? calcularCustoPorTempo(tempoEstimadoDia, tarefa.responsavelId)
                                  : null;

                                const custoRealizadoDia = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                  ? calcularCustoPorTempo(tempoRealizadoDia, tarefa.responsavelId)
                                  : null;

                                return (
                                  <div
                                    key={`data_${tarefa.id}_${dataNormalizada}`}
                                    className="tarefa-detalhada-data-group"
                                  >
                                    <div className="tarefa-detalhada-data-header">
                                      <div className="tarefa-detalhada-data-label">
                                        {formatarDataExibicao(dataNormalizada)}
                                      </div>
                                      <div className="tarefa-detalhada-data-metrics">
                                        {/* Card Estimado do Dia */}
                                        {tempoEstimadoDia > 0 && (
                                          <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado tarefa-detalhada-tempo-card-dia">
                                            <div className="tarefa-detalhada-tempo-card-content">
                                              <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '10px' }}></i>
                                              <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                                {tempoEstimadoFormatado}
                                              </div>
                                              {custoEstimadoDia !== null && formatarValorMonetario && (
                                                <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                                  {formatarValorMonetario(custoEstimadoDia)}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Card Realizado do Dia */}
                                        <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado tarefa-detalhada-tempo-card-dia">
                                          <div className="tarefa-detalhada-tempo-card-content">
                                            <i className="fas fa-stopwatch" style={{ color: '#fd7e14', fontSize: '10px' }}></i>
                                            <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                                              {tempoRealizadoFormatado}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Lista de registros individuais da data - Agrupados por responsável */}
                                    {grupoData.registros.length > 0 && (() => {
                                      // Agrupar registros por responsável
                                      const registrosPorResponsavel = new Map();

                                      grupoData.registros.forEach((registro) => {
                                        const responsavelId = registro.usuario_id || registro.membro?.id || 'desconhecido';
                                        let nomeResponsavel = registro.membro?.nome;

                                        // Se não encontrou no registro.membro, buscar usando a função
                                        if (!nomeResponsavel && getNomeColaboradorPorUsuarioId && responsavelId !== 'desconhecido') {
                                          nomeResponsavel = getNomeColaboradorPorUsuarioId(responsavelId);
                                        }

                                        // Fallback para caso não encontre
                                        if (!nomeResponsavel) {
                                          nomeResponsavel = `Colaborador #${responsavelId}`;
                                        }

                                        const responsavelKey = String(responsavelId);

                                        if (!registrosPorResponsavel.has(responsavelKey)) {
                                          registrosPorResponsavel.set(responsavelKey, {
                                            nome: nomeResponsavel,
                                            registros: []
                                          });
                                        }

                                        registrosPorResponsavel.get(responsavelKey).registros.push(registro);
                                      });

                                      return (
                                        <div className="tarefa-detalhada-registros-individuais">
                                          {Array.from(registrosPorResponsavel.entries()).map(([responsavelKey, grupoResponsavel]) => {
                                            // Calcular tempo total do responsável
                                            let tempoTotalResponsavel = 0;
                                            grupoResponsavel.registros.forEach(reg => {
                                              let tempoReg = Number(reg.tempo_realizado) || 0;
                                              // Converter horas decimais para milissegundos se necessário
                                              if (tempoReg > 0 && tempoReg < 1) {
                                                tempoReg = Math.round(tempoReg * 3600000);
                                              }
                                              // Se resultado < 1 segundo, arredondar para 1 segundo
                                              if (tempoReg > 0 && tempoReg < 1000) {
                                                tempoReg = 1000;
                                              }
                                              tempoTotalResponsavel += tempoReg;
                                            });

                                            const tempoTotalFormatado = formatarTempoEstimado
                                              ? formatarTempoEstimado(tempoTotalResponsavel, true)
                                              : formatarTempoHMS(tempoTotalResponsavel);

                                            const responsavelKeyFull = `${tarefa.id}_${dataNormalizada}_${responsavelKey}`;
                                            const isResponsavelExpanded = responsaveisExpandidos.has(responsavelKeyFull);

                                            return (
                                              <div key={`responsavel_${tarefa.id}_${dataNormalizada}_${responsavelKey}`} className="tarefa-detalhada-responsavel-group">
                                                <div className="tarefa-detalhada-responsavel-header">
                                                  <div className="tarefa-detalhada-responsavel-nome-wrapper">
                                                    <i className="fas fa-user" style={{ color: '#6b7280', fontSize: '13px' }}></i>
                                                    <span className="tarefa-detalhada-responsavel-nome">{grupoResponsavel.nome}</span>
                                                  </div>
                                                  <button
                                                    className="tarefa-detalhada-responsavel-toggle"
                                                    onClick={() => toggleResponsavel(tarefa.id, dataNormalizada, responsavelKey)}
                                                    title={isResponsavelExpanded ? "Ocultar registros" : "Ver registros"}
                                                  >
                                                    <i
                                                      className={`fas fa-chevron-down ${isResponsavelExpanded ? 'expanded' : ''}`}
                                                      style={{
                                                        color: '#1e3a8a',
                                                        fontSize: '12px',
                                                        transform: isResponsavelExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.2s'
                                                      }}
                                                    ></i>
                                                  </button>
                                                </div>
                                                {isResponsavelExpanded && (
                                                  <div className="tarefa-detalhada-responsavel-registros">
                                                    {grupoResponsavel.registros.map((registro, regIdx) => {
                                                      const tempoRealizadoReg = registro.tempo_realizado || 0;
                                                      // Converter horas decimais para milissegundos se necessário
                                                      let tempoMs = tempoRealizadoReg;
                                                      if (tempoRealizadoReg > 0 && tempoRealizadoReg < 1) {
                                                        tempoMs = Math.round(tempoRealizadoReg * 3600000);
                                                      }
                                                      // Se resultado < 1 segundo, arredondar para 1 segundo
                                                      if (tempoMs > 0 && tempoMs < 1000) {
                                                        tempoMs = 1000;
                                                      }

                                                      const tempoRealizadoFormatado = formatarTempoEstimado
                                                        ? formatarTempoEstimado(tempoMs, true)
                                                        : formatarTempoHMS(tempoMs);

                                                      const tempoDecimal = (tempoMs / 3600000).toFixed(2);

                                                      // Formatar data e hora completa
                                                      const dataFormatada = formatarDataHora(registro.data_inicio || registro.created_at || registro.data);

                                                      return (
                                                        <div
                                                          key={`reg_${tarefa.id}_${dataNormalizada}_${responsavelKey}_${regIdx}_${registro.id || regIdx}`}
                                                          className="tarefa-detalhada-registro-item-simples"
                                                        >
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <i className="fas fa-stopwatch" style={{ color: '#94a3b8' }}></i>
                                                            <span
                                                              className="tarefa-detalhada-registro-tempo-badge"
                                                              title={`${tempoDecimal}h`}
                                                            >
                                                              {tempoRealizadoFormatado}
                                                            </span>
                                                          </div>
                                                          {dataFormatada !== '—' && (
                                                            <div style={{ color: '#6b7280' }}>{dataFormatada}</div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProdutosDetalhadosList;

