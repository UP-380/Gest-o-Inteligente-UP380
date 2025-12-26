import React, { useState } from 'react';
import { useHistoricoTempo } from '../../hooks/useHistoricoTempo';
import RegistroTempoItem from './RegistroTempoItem';
import './HistoTempoRastreado.css';

/**
 * Componente para exibir o histórico de tempo rastreado
 * Agrupa por data, depois por cliente, depois por tarefa, e depois por registros individuais
 * 
 * @param {Object} props
 * @param {Function} props.onEditar - Callback quando clicar em editar (recebe evento e registro)
 * @param {Function} props.onDeletar - Callback quando clicar em deletar (recebe evento e registro)
 * @param {Function} props.onSalvarEdicao - Callback para salvar edição (recebe registro)
 * @param {Function} props.onConfirmarDelecao - Callback para confirmar deleção (recebe registro)
 * @param {Function} props.onFecharEdicao - Callback para fechar edição (recebe registroId)
 * @param {Function} props.onFecharDelecao - Callback para fechar deleção (recebe registroId)
 * @param {Function} props.onAtualizarFormData - Callback para atualizar formData de um registro
 * @param {Function} props.onAtualizarJustificativaDelecao - Callback para atualizar justificativa de deleção
 * @param {Object} props.registroEditandoId - ID do registro sendo editado
 * @param {Object} props.registroDeletandoId - ID do registro sendo deletado
 * @param {Object} props.formDataPorRegistro - Objeto com dados do formulário por registro ID
 * @param {Object} props.justificativaDelecaoPorRegistro - Objeto com justificativas de deleção por registro ID
 * @param {Function} props.onBuscarHistorico - Callback opcional para buscar histórico (se não usar hook interno)
 * @param {Array} props.historicoAgrupadoPorData - Array opcional de grupos de data (se não usar hook interno)
 * @param {Object} props.nomesTarefas - Objeto opcional com nomes das tarefas por ID (se não usar hook interno)
 * @param {Object} props.nomesClientes - Objeto opcional com nomes dos clientes por ID (se não usar hook interno)
 * @param {Function} props.formatarTempoHMS - Função opcional para formatar tempo (se não usar hook interno)
 * @param {Function} props.formatarPeriodo - Função opcional para formatar período (se não usar hook interno)
 * @param {Function} props.calcularTotal - Função opcional para calcular total (se não usar hook interno)
 */
const HistoTempoRastreado = ({
  onEditar,
  onDeletar,
  onSalvarEdicao,
  onConfirmarDelecao,
  onFecharEdicao,
  onFecharDelecao,
  onAtualizarFormData,
  onAtualizarJustificativaDelecao,
  registroEditandoId,
  registroDeletandoId,
  formDataPorRegistro,
  justificativaDelecaoPorRegistro,
  // Props opcionais para usar dados externos ao invés do hook
  onBuscarHistorico,
  historicoAgrupadoPorData: historicoAgrupadoPorDataExterno,
  nomesTarefas: nomesTarefasExterno,
  nomesClientes: nomesClientesExterno,
  formatarTempoHMS: formatarTempoHMSExterno,
  formatarPeriodo: formatarPeriodoExterno,
  calcularTotal: calcularTotalExterno
}) => {
  const [clientesExpandidos, setClientesExpandidos] = useState({});
  const [tarefasExpandidas, setTarefasExpandidas] = useState({});
  
  // Usar hook interno ou props externas
  const {
    historicoAgrupadoPorData: historicoAgrupadoPorDataHook,
    nomesTarefas: nomesTarefasHook,
    formatarTempoHMS: formatarTempoHMSHook,
    formatarPeriodo: formatarPeriodoHook,
    calcularTotal: calcularTotalHook,
    buscarHistorico
  } = useHistoricoTempo();

  // Usar dados externos se fornecidos, caso contrário usar hook
  const historicoAgrupadoPorData = historicoAgrupadoPorDataExterno || historicoAgrupadoPorDataHook;
  const nomesTarefas = nomesTarefasExterno || nomesTarefasHook;
  const nomesClientes = nomesClientesExterno || {};
  const formatarTempoHMS = formatarTempoHMSExterno || formatarTempoHMSHook;
  const formatarPeriodo = formatarPeriodoExterno || formatarPeriodoHook;
  const calcularTotal = calcularTotalExterno || calcularTotalHook;
  const handleBuscarHistorico = onBuscarHistorico || buscarHistorico;

  if (!historicoAgrupadoPorData || historicoAgrupadoPorData.length === 0) {
    return (
      <div className="timer-dropdown-empty">Nenhum registro encontrado</div>
    );
  }

  return (
    <div className="timer-dropdown-historico">
      {historicoAgrupadoPorData.map((grupoData) => {
        // Calcular total da data (somar todos os registros de todos os clientes e tarefas)
        const totalData = Object.values(grupoData.clientes || {}).reduce((totalData, cliente) => {
          return totalData + Object.values(cliente.tarefas || {}).reduce((totalCliente, tarefa) => {
            return totalCliente + calcularTotal(tarefa.registros);
          }, 0);
        }, 0);
        
        return (
          <div key={grupoData.data} className="timer-dropdown-data-group">
            {/* Cabeçalho da Data (fixo, não expansível) */}
            <div className="timer-dropdown-data-header">
              <span className="timer-dropdown-data-label">
                {grupoData.dataFormatada}
              </span>
              <span className="timer-dropdown-data-total">
                {formatarTempoHMS(totalData)}
              </span>
            </div>
            
            {/* Clientes dentro desta data */}
            <div className="timer-dropdown-clientes-por-data">
              {Object.entries(grupoData.clientes || {}).map(([clienteId, grupoCliente]) => {
                // Calcular total do cliente (somar todas as tarefas)
                const totalCliente = Object.values(grupoCliente.tarefas || {}).reduce((total, tarefa) => {
                  return total + calcularTotal(tarefa.registros);
                }, 0);
                const nomeCliente = nomesClientes[clienteId] || `Cliente #${clienteId}`;
                const chaveCliente = `${grupoData.data}_${clienteId}`;
                const isClienteExpandido = clientesExpandidos[chaveCliente] || false;
                
                return (
                  <div key={chaveCliente} className={`timer-dropdown-cliente ${isClienteExpandido ? 'expanded' : ''}`}>
                    <div 
                      className="timer-dropdown-cliente-header"
                      onClick={() => setClientesExpandidos({ ...clientesExpandidos, [chaveCliente]: !isClienteExpandido })}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <i className={`fas fa-chevron-right timer-dropdown-cliente-arrow ${isClienteExpandido ? 'expanded' : ''}`}></i>
                        <span className="timer-dropdown-cliente-nome">
                          {nomeCliente}
                        </span>
                      </div>
                      <span className="timer-dropdown-cliente-total">
                        {formatarTempoHMS(totalCliente)}
                      </span>
                    </div>
                    {isClienteExpandido && (
                      <div className="timer-dropdown-tarefas-por-cliente">
                        {Object.entries(grupoCliente.tarefas || {}).map(([tarefaId, grupoTarefa]) => {
                          const totalTarefa = calcularTotal(grupoTarefa.registros);
                          const nomeTarefa = nomesTarefas[tarefaId] || `Tarefa #${tarefaId}`;
                          const chaveTarefa = `${grupoData.data}_${clienteId}_${tarefaId}`;
                          const isExpandida = tarefasExpandidas[chaveTarefa] || false;
                          
                          return (
                            <div key={chaveTarefa} className={`timer-dropdown-tarefa ${isExpandida ? 'expanded' : ''}`}>
                              <div 
                                className="timer-dropdown-tarefa-header"
                                onClick={() => setTarefasExpandidas({ ...tarefasExpandidas, [chaveTarefa]: !isExpandida })}
                                style={{ cursor: 'pointer' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                  <i className={`fas fa-chevron-right timer-dropdown-tarefa-arrow ${isExpandida ? 'expanded' : ''}`}></i>
                                  <span className="timer-dropdown-tarefa-nome-historico">
                                    {nomeTarefa}
                                  </span>
                                </div>
                                <span className="timer-dropdown-tarefa-total">
                                  {formatarTempoHMS(totalTarefa)}
                                </span>
                              </div>
                              {isExpandida && (
                                <div className="timer-dropdown-registros">
                                  {grupoTarefa.registros.map((reg) => {
                                    const isEditando = registroEditandoId === reg.id;
                                    const isDeletando = registroDeletandoId === reg.id;
                                    const formData = formDataPorRegistro[reg.id] || {};
                                    const justificativaDelecao = justificativaDelecaoPorRegistro[reg.id] || '';
                                    
                                    return (
                                      <RegistroTempoItem
                                        key={reg.id}
                                        registro={reg}
                                        formatarTempoHMS={formatarTempoHMS}
                                        formatarPeriodo={formatarPeriodo}
                                        isEditando={isEditando}
                                        isDeletando={isDeletando}
                                        formData={formData}
                                        justificativaDelecao={justificativaDelecao}
                                        onEditar={onEditar}
                                        onDeletar={onDeletar}
                                        onSalvarEdicao={onSalvarEdicao}
                                        onConfirmarDelecao={onConfirmarDelecao}
                                        onFecharEdicao={onFecharEdicao}
                                        onFecharDelecao={onFecharDelecao}
                                        onAtualizarFormData={onAtualizarFormData}
                                        onAtualizarJustificativaDelecao={onAtualizarJustificativaDelecao}
                                      />
                                    );
                                  })}
                                </div>
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
          </div>
        );
      })}
    </div>
  );
};

export default HistoTempoRastreado;
