import React from 'react';
import Avatar from '../user/Avatar';
import EditButton from '../common/EditButton';
import DeleteButton from '../common/DeleteButton';

/**
 * Tabela de atribuições (modo simples, sem filtro principal).
 * Renderiza os agrupamentos com responsável, tempo total e período.
 */
const AtribuicoesTabela = ({
  registrosAgrupados,
  periodoInicio,
  periodoFim,
  tarefasExpandidas,
  toggleTarefa,
  getNomeTarefa,
  getNomeProduto,
  getNomeCliente,
  getNomeColaborador,
  formatarTempoComCusto,
  formatarPeriodo,
  handleEditAtribuicao,
  setAgrupamentoParaDeletar,
  setShowDeleteConfirmModal
}) => {
  const calcularDiasFiltrado = (agrupamento) => {
    const { quantidade, dataInicio, dataFim } = agrupamento;

    if (periodoInicio && periodoFim && dataInicio && dataFim) {
      const inicioAgrupamento = new Date(dataInicio);
      const fimAgrupamento = new Date(dataFim);
      const inicioFiltro = new Date(periodoInicio);
      const fimFiltro = new Date(periodoFim);

      inicioFiltro.setHours(0, 0, 0, 0);
      fimFiltro.setHours(23, 59, 59, 999);
      inicioAgrupamento.setHours(0, 0, 0, 0);
      fimAgrupamento.setHours(23, 59, 59, 999);

      const inicioIntersecao = inicioAgrupamento > inicioFiltro ? inicioAgrupamento : inicioFiltro;
      const fimIntersecao = fimAgrupamento < fimFiltro ? fimAgrupamento : fimFiltro;

      if (inicioIntersecao <= fimIntersecao) {
        const diffTime = fimIntersecao - inicioIntersecao;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
      }
      return 0;
    }

    return quantidade;
  };

  return (
    <div className="atribuicoes-group-content">
      <table className="atribuicoes-table">
        <thead>
          <tr>
            <th>Tarefas Agrupadas</th>
            <th>Produto</th>
            <th>Cliente</th>
            <th>Responsável</th>
            <th>Tempo Estimado Total</th>
            <th>Período</th>
            <th className="atribuicoes-table-actions">Ações</th>
          </tr>
        </thead>
        <tbody>
          {registrosAgrupados.map((agrupamento) => {
            const primeiroRegistro = agrupamento.primeiroRegistro;
            const produtosUnicos = [...new Set(agrupamento.registros.map((r) => r.produto_id))];
            const tarefasUnicas = [...new Set(agrupamento.registros.map((r) => r.tarefa_id))];
            const tempoEstimadoDia = primeiroRegistro.tempo_estimado_dia || 0;
            const quantidadeDiasFiltrado = calcularDiasFiltrado(agrupamento);
            const tempoEstimadoTotal = tempoEstimadoDia * quantidadeDiasFiltrado;

            return (
              <React.Fragment key={agrupamento.agrupador_id}>
                <tr>
                  <td>
                    {tarefasUnicas.map((tarefaId) => {
                      const tarefaKey = `${agrupamento.agrupador_id}_${tarefaId}`;
                      const isTarefaExpanded = tarefasExpandidas.has(tarefaKey);
                      return (
                        <button
                          key={tarefaId}
                          type="button"
                          className={`atribuicoes-tag atribuicoes-tag-clickable ${isTarefaExpanded ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTarefa(agrupamento.agrupador_id, tarefaId);
                          }}
                          title={isTarefaExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                        >
                          {getNomeTarefa(tarefaId)}
                          <i
                            className={`fas fa-chevron-${isTarefaExpanded ? 'down' : 'right'}`}
                            style={{ marginLeft: '6px', fontSize: '10px' }}
                          ></i>
                        </button>
                      );
                    })}
                  </td>
                  <td>
                    {produtosUnicos.map((produtoId) => (
                      <span key={produtoId} className="atribuicoes-tag atribuicoes-tag-produto">
                        {getNomeProduto(produtoId)}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className="atribuicoes-tag atribuicoes-tag-cliente">
                      {getNomeCliente(primeiroRegistro.cliente_id)}
                    </span>
                  </td>
                  <td className="atribuicoes-col-responsavel">
                    <div
                      className="responsavel-avatar-wrapper has-tooltip"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Avatar
                        avatarId={primeiroRegistro.responsavel_foto_perfil}
                        nomeUsuario={getNomeColaborador(primeiroRegistro.responsavel_id)}
                        size="tiny"
                      />
                      <div className="responsavel-tooltip">{getNomeColaborador(primeiroRegistro.responsavel_id)}</div>
                    </div>
                  </td>
                  <td>
                    <span className="atribuicoes-tempo">
                      {formatarTempoComCusto(tempoEstimadoTotal, primeiroRegistro.responsavel_id, true)}
                    </span>
                  </td>
                  <td>
                    <span className="atribuicoes-periodo">
                      {formatarPeriodo(agrupamento.dataInicio, agrupamento.dataFim)}
                    </span>
                  </td>
                  <td className="atribuicoes-table-actions">
                    <div className="atribuicoes-row-actions">
                      <EditButton onClick={() => handleEditAtribuicao(agrupamento)} title="Editar atribuição" />
                      <DeleteButton
                        onClick={() => {
                          setAgrupamentoParaDeletar(agrupamento);
                          setShowDeleteConfirmModal(true);
                        }}
                        title="Excluir atribuição"
                      />
                    </div>
                  </td>
                </tr>

                {tarefasUnicas.map((tarefaId) => {
                  const tarefaKey = `${agrupamento.agrupador_id}_${tarefaId}`;
                  if (!tarefasExpandidas.has(tarefaKey)) return null;

                  const registrosTarefa = agrupamento.registros.filter(
                    (r) => String(r.tarefa_id) === String(tarefaId)
                  );

                  return (
                    <tr key={`detalhes_${tarefaKey}`} className="atribuicoes-tarefa-detalhes">
                      <td colSpan="7" className="atribuicoes-tarefa-detalhes-cell">
                        <div className="atribuicoes-tarefa-detalhes-content">
                          <div className="atribuicoes-tarefa-detalhes-header">
                            <h4>{getNomeTarefa(tarefaId)} - Detalhes</h4>
                            <span className="atribuicoes-tarefa-detalhes-count">
                              {registrosTarefa.length} registro(s)
                            </span>
                          </div>
                          <table className="atribuicoes-detalhes-table">
                            <thead>
                              <tr>
                                <th>Data</th>
                                <th>Produto</th>
                                <th>Cliente</th>
                                <th className="atribuicoes-col-responsavel">Responsável</th>
                                <th>Tempo Estimado (dia)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {registrosTarefa.map((registro, idx) => (
                                <tr key={`${tarefaKey}_registro_${idx}`}>
                                  <td>{registro.data_formatada || registro.data}</td>
                                  <td>
                                    <span className="atribuicoes-tag atribuicoes-tag-produto">
                                      {getNomeProduto(registro.produto_id)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="atribuicoes-tag atribuicoes-tag-cliente">
                                      {getNomeCliente(registro.cliente_id)}
                                    </span>
                                  </td>
                                  <td className="atribuicoes-col-responsavel">
                                    <div
                                      className="responsavel-avatar-wrapper has-tooltip"
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                      <Avatar
                                        avatarId={registro.responsavel_foto_perfil}
                                        nomeUsuario={getNomeColaborador(registro.responsavel_id)}
                                        size="tiny"
                                      />
                                      <div className="responsavel-tooltip">
                                        {getNomeColaborador(registro.responsavel_id)}
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="atribuicoes-tempo">
                                      {formatarTempoComCusto(registro.tempo_estimado_dia || 0, registro.responsavel_id)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AtribuicoesTabela;

