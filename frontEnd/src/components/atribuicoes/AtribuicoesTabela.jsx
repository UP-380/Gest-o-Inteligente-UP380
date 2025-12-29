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
  const calcularTempoEstimadoTotalAgrupamento = (agrupamento) => {
    if (!agrupamento || !agrupamento.registros) return 0;
    const registrosFiltrados =
      periodoInicio && periodoFim
        ? agrupamento.registros.filter((registro) => {
            try {
              if (!registro.data) return false;
              let dataReg = new Date(registro.data);
              let inicio = new Date(periodoInicio);
              let fim = new Date(periodoFim);
              dataReg.setHours(0, 0, 0, 0);
              inicio.setHours(0, 0, 0, 0);
              fim.setHours(23, 59, 59, 999);
              return dataReg >= inicio && dataReg <= fim;
            } catch {
              return false;
            }
          })
        : agrupamento.registros;
    return registrosFiltrados.reduce(
      (acc, reg) => acc + (reg.tempo_estimado_dia || agrupamento.primeiroRegistro?.tempo_estimado_dia || 0),
      0
    );
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
            const tempoEstimadoTotal = calcularTempoEstimadoTotalAgrupamento(agrupamento);

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




