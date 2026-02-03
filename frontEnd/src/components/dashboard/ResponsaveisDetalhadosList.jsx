import React, { useState } from 'react';
import './TarefasDetalhadasList.css';

/**
 * Componente para listar responsáveis detalhados com tempo estimado, realizado, custos, produtos, clientes e tarefas
 * 
 * @param {Object} props
 * @param {Array} props.responsaveis - Array de responsáveis com tempo realizado, estimado, custo, produtos, clientes e tarefas
 * @param {Set} props.responsaveisExpandidos - Set com IDs dos responsáveis expandidos
 * @param {Object} props.registrosIndividuais - Objeto com registros individuais por tarefa ID
 * @param {Object} props.carregandoRegistros - Objeto com estado de carregamento por tarefa ID
 * @param {Function} props.formatarTempoEstimado - Função para formatar tempo estimado
 * @param {Function} props.calcularCustoPorTempo - Função para calcular custo por tempo
 * @param {Function} props.formatarValorMonetario - Função para formatar valor monetário
 * @param {Function} props.formatarDataHora - Função para formatar data e hora
 * @param {Function} props.formatarTempoHMS - Função para formatar tempo em HMS
 * @param {Function} props.onToggleResponsavel - Função chamada ao clicar no botão de expandir/colapsar responsável
 * @param {Function} props.buscarRegistrosIndividuais - Função para buscar registros individuais de uma tarefa
 * @param {Object} props.temposRealizadosPorResponsavel - Objeto com tempos realizados por responsável ID (chave: responsavelId, valor: tempoEmMs)
 */
const ResponsaveisDetalhadosList = ({
  responsaveis,
  responsaveisExpandidos,
  registrosIndividuais,
  carregandoRegistros,
  formatarTempoEstimado,
  calcularCustoPorTempo,
  formatarValorMonetario,
  formatarDataHora,
  formatarTempoHMS,
  onToggleResponsavel,
  buscarRegistrosIndividuais,
  getNomeColaboradorPorUsuarioId = null,
  temposRealizadosPorResponsavel = {},
  temposRealizadosPorProduto = {},
  temposRealizadosPorCliente = {},
  temposRealizadosPorTarefa = {}
}) => {
  const [produtosExpandidos, setProdutosExpandidos] = useState(new Set());
  const [clientesExpandidos, setClientesExpandidos] = useState(new Set());
  const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());
  const [responsaveisRegistrosExpandidos, setResponsaveisRegistrosExpandidos] = useState(new Set());

  const toggleResponsavel = (tarefaId, dataNormalizada, responsavelKey) => {
    const key = `${tarefaId}_${dataNormalizada}_${responsavelKey}`;
    setResponsaveisRegistrosExpandidos(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
      }
      return newExpanded;
    });
  };

  if (!responsaveis || responsaveis.length === 0) {
    return (
      <div className="tarefas-detalhadas-empty">
        <p>Nenhum responsável encontrado</p>
      </div>
    );
  }

  const toggleProduto = (responsavelId, produtoId) => {
    const key = `${responsavelId}-${produtoId}`;
    setProdutosExpandidos(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
      }
      return newExpanded;
    });
  };

  const toggleCliente = (responsavelId, produtoId, clienteId) => {
    const key = `${responsavelId}-${produtoId}-${clienteId}`;
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

  const toggleTarefa = (responsavelId, produtoId, clienteId, tarefaId, tarefa) => {
    const key = `${responsavelId}-${produtoId}-${clienteId}-${tarefaId}`;
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
      {responsaveis.map((responsavel, responsavelIndex) => {
        const isResponsavelExpanded = responsaveisExpandidos.has(responsavel.id);
        // Buscar tempo realizado do prop ou usar 0 como padrão
        const tempoRealizadoMs = temposRealizadosPorResponsavel[responsavel.id] || responsavel.tempoRealizado || 0;
        const tempoRealizadoFormatado = formatarTempoHMS
          ? formatarTempoHMS(tempoRealizadoMs)
          : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoMs, true) : '0s');

        const tempoEstimadoFormatado = formatarTempoEstimado
          ? formatarTempoEstimado(responsavel.tempoEstimado || 0, true)
          : '0s';

        // Calcular custo estimado
        const custoEstimado = responsavel.responsavelId && calcularCustoPorTempo && formatarValorMonetario
          ? calcularCustoPorTempo(responsavel.tempoEstimado || 0, responsavel.responsavelId)
          : null;

        return (
          <div
            key={`responsavel_${responsavel.id}_${responsavelIndex}`}
            className="tarefa-detalhada-card tarefa-detalhada-card-nivel-1"
          >
            <div className="tarefa-detalhada-header">
              <div className="tarefa-detalhada-info">
                <div className="tarefa-detalhada-nome">
                  <i className="fas fa-user-tie" style={{ marginRight: '8px' }}></i>
                  {responsavel.nome}
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
              {responsavel.produtos && responsavel.produtos.length > 0 && (
                <button
                  className="tarefa-detalhada-toggle"
                  onClick={() => onToggleResponsavel(responsavel.id)}
                  title={isResponsavelExpanded ? "Ocultar produtos" : "Ver produtos"}
                >
                  <i
                    className={`fas fa-chevron-down ${isResponsavelExpanded ? 'expanded' : ''}`}
                  ></i>
                </button>
              )}
            </div>
            {isResponsavelExpanded && responsavel.produtos && responsavel.produtos.length > 0 && (
              <div className="tarefa-detalhada-registros">
                <div className="tarefa-detalhada-registros-title">
                  Produtos ({responsavel.produtos.length}):
                </div>
                <div className="tarefa-detalhada-cliente-tarefas">
                  {responsavel.produtos.map((produto, produtoIndex) => {
                    const produtoKey = `${responsavel.id}-${produto.id}`;
                    const isProdutoExpanded = produtosExpandidos.has(produtoKey);
                    // Tempo realizado: tentar buscar do mapa hierárquico

                    const produtoKeyAlt = String(produto.id); // Fallback para ID simples
                    const tempoRealizadoProdutoMs = temposRealizadosPorProduto[produtoKey]
                      || temposRealizadosPorProduto[produtoKeyAlt]
                      || produto.tempoRealizado
                      || 0;

                    const tempoRealizadoProdutoFormatado = formatarTempoHMS
                      ? formatarTempoHMS(tempoRealizadoProdutoMs)
                      : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoProdutoMs, true) : '0s');

                    const tempoEstimadoProdutoFormatado = formatarTempoEstimado
                      ? formatarTempoEstimado(produto.tempoEstimado || 0, true)
                      : '0s';

                    // Calcular custo estimado do produto
                    const custoEstimadoProduto = responsavel.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                      ? calcularCustoPorTempo(produto.tempoEstimado || 0, responsavel.responsavelId)
                      : null;

                    return (
                      <div
                        key={`produto_${produto.id}_${produtoIndex}`}
                        className="tarefa-detalhada-card tarefa-detalhada-card-nivel-2"
                        style={{ marginTop: '8px' }}
                      >
                        <div className="tarefa-detalhada-header">
                          <div className="tarefa-detalhada-info">
                            <div className="tarefa-detalhada-nome">
                              <i className="fas fa-box" style={{ marginRight: '8px' }}></i>
                              {produto.nome}
                            </div>
                            <div className="tarefa-detalhada-metrics">
                              {/* Card Estimado do Produto */}
                              <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado tarefa-detalhada-tempo-card-dia">
                                <div className="tarefa-detalhada-tempo-card-content">
                                  <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '10px' }}></i>
                                  <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                    {tempoEstimadoProdutoFormatado}
                                  </div>
                                  {custoEstimadoProduto !== null && formatarValorMonetario && (
                                    <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                      {formatarValorMonetario(custoEstimadoProduto)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Card Realizado do Produto */}
                              <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado tarefa-detalhada-tempo-card-dia">
                                <div className="tarefa-detalhada-tempo-card-content">
                                  <i className="fas fa-stopwatch" style={{ color: '#fd7e14', fontSize: '10px' }}></i>
                                  <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                                    {tempoRealizadoProdutoFormatado}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {(produto.clientes && produto.clientes.length > 0) || (produto.tarefas && produto.tarefas.length > 0) ? (
                            <button
                              className="tarefa-detalhada-toggle"
                              onClick={() => toggleProduto(responsavel.id, produto.id)}
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
                                const clienteKey = `${responsavel.id}-${produto.id}-${cliente.id}`;
                                const isClienteExpanded = clientesExpandidos.has(clienteKey);

                                // Tempo realizado: tentar buscar do mapa hierárquico
                                const clienteKeyAlt = String(cliente.id); // Fallback para ID simples
                                const tempoRealizadoClienteMs = temposRealizadosPorCliente[clienteKey]
                                  || temposRealizadosPorCliente[clienteKeyAlt]
                                  || cliente.tempoRealizado
                                  || 0;

                                const tempoRealizadoClienteFormatado = formatarTempoHMS
                                  ? formatarTempoHMS(tempoRealizadoClienteMs)
                                  : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoClienteMs, true) : '0s');

                                const tempoEstimadoClienteFormatado = formatarTempoEstimado
                                  ? formatarTempoEstimado(cliente.tempoEstimado || 0, true)
                                  : '0s';

                                // Calcular custo estimado do cliente
                                const custoEstimadoCliente = responsavel.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                  ? calcularCustoPorTempo(cliente.tempoEstimado || 0, responsavel.responsavelId)
                                  : null;

                                return (
                                  <div
                                    key={`cliente_${cliente.id}_${clienteIndex}`}
                                    className="tarefa-detalhada-card tarefa-detalhada-card-nivel-3"
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
                                          onClick={() => toggleCliente(responsavel.id, produto.id, cliente.id)}
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
                                            const tarefaKey = `${responsavel.id}-${produto.id}-${cliente.id}-${tarefa.id}`;
                                            const isTarefaExpanded = tarefasExpandidas.has(tarefaKey);

                                            // Tempo realizado: tentar buscar do mapa, depois tarefa diretamente
                                            const tarefaKeyAlt = String(tarefa.id);
                                            // Realizado da tarefa: apenas do mapa/cache (carregado ao abrir o card). Não usar registrosIndividuais para não interferir ao abrir "Registros de tempo".
                                            let tempoRealizadoTarefaMs = temposRealizadosPorTarefa[tarefaKey]
                                              || temposRealizadosPorTarefa[tarefaKeyAlt]
                                              || tarefa.tempoRealizado
                                              || 0;

                                            const tempoRealizadoTarefaFormatado = formatarTempoHMS
                                              ? formatarTempoHMS(tempoRealizadoTarefaMs)
                                              : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoTarefaMs, true) : '0s');

                                            const tempoEstimadoTarefaFormatado = formatarTempoEstimado
                                              ? formatarTempoEstimado(tarefa.tempoEstimado || 0, true)
                                              : '0s';

                                            // Calcular custo estimado da tarefa
                                            const custoEstimadoTarefa = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                              ? calcularCustoPorTempo(tarefa.tempoEstimado || 0, tarefa.responsavelId)
                                              : null;

                                            return (
                                              <div
                                                key={`tarefa_${tarefa.id}_${tarefaIndex}`}
                                                className="tarefa-detalhada-card tarefa-detalhada-card-nivel-4"
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
                                                      onClick={() => toggleTarefa(responsavel.id, produto.id, cliente.id, tarefa.id, tarefa)}
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
                                                              : formatarTempoHMS(tempoRealizadoDia);

                                                            // Calcular custos
                                                            const custoEstimadoDia = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                                              ? calcularCustoPorTempo(tempoEstimadoDia, tarefa.responsavelId)
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
                                                                        const isResponsavelExpanded = responsaveisRegistrosExpandidos.has(responsavelKeyFull);

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
                                const tarefaKey = `${responsavel.id}-${produto.id}-${tarefa.id}`;
                                const isTarefaExpanded = tarefasExpandidas.has(tarefaKey);
                                // Tempo realizado: tentar buscar do mapa, depois tarefa diretamente
                                const tarefaKeyAlt = String(tarefa.id);
                                // Realizado da tarefa: apenas do mapa/cache (carregado ao abrir o card). Não usar registrosIndividuais para não interferir ao abrir "Registros de tempo".
                                let tempoRealizadoTarefaMs = temposRealizadosPorTarefa[tarefaKey]
                                  || temposRealizadosPorTarefa[tarefaKeyAlt]
                                  || tarefa.tempoRealizado
                                  || 0;

                                const tempoRealizadoTarefaFormatado = formatarTempoHMS
                                  ? formatarTempoHMS(tempoRealizadoTarefaMs)
                                  : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoTarefaMs, true) : '0s');

                                const tempoEstimadoTarefaFormatado = formatarTempoEstimado
                                  ? formatarTempoEstimado(tarefa.tempoEstimado || 0, true)
                                  : '0s';

                                // Calcular custo realizado da tarefa
                                const custoRealizadoTarefa = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                  ? calcularCustoPorTempo(tarefa.tempoRealizado || 0, tarefa.responsavelId)
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
                                              {custoRealizadoTarefa !== null && formatarValorMonetario && (
                                                <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-realizado">
                                                  {formatarValorMonetario(custoRealizadoTarefa)}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      {(() => {
                                        const registrosTarefa = registrosIndividuais[tarefa.id] || [];
                                        return registrosTarefa.length > 0 ? (
                                          <button
                                            className="tarefa-detalhada-toggle"
                                            onClick={() => toggleTarefa(responsavel.id, produto.id, tarefa.id, tarefa)}
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
                                        const tempoRealizadoReg = registro.tempo_realizado || 0;
                                        grupoData.registros.push(registro);
                                        // Tempo realizado sempre 0 (lógica removida)
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
                                              : formatarTempoHMS(tempoRealizadoDia);

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
                                                        const isResponsavelExpanded = responsaveisRegistrosExpandidos.has(responsavelKeyFull);

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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ResponsaveisDetalhadosList;

