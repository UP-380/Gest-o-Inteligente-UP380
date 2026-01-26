import React, { useState } from 'react';
import TarefasDetalhadasList from './TarefasDetalhadasList';
import './TarefasDetalhadasList.css';

/**
 * Componente para listar tipos de tarefa detalhados com tempo estimado, realizado, custos e tarefas
 * 
 * @param {Object} props
 * @param {Array} props.tiposTarefa - Array de tipos de tarefa com tempo realizado, estimado, custo e tarefas
 * @param {Set} props.tiposTarefaExpandidos - Set com IDs dos tipos de tarefa expandidos
 * @param {Object} props.registrosIndividuais - Objeto com registros individuais por tarefa ID
 * @param {Object} props.carregandoRegistros - Objeto com estado de carregamento por tarefa ID
 * @param {Function} props.formatarTempoEstimado - Função para formatar tempo estimado
 * @param {Function} props.calcularCustoPorTempo - Função para calcular custo por tempo
 * @param {Function} props.formatarValorMonetario - Função para formatar valor monetário
 * @param {Function} props.formatarDataHora - Função para formatar data e hora
 * @param {Function} props.formatarTempoHMS - Função para formatar tempo em HMS
 * @param {Function} props.onToggleTipoTarefa - Função chamada ao clicar no botão de expandir/colapsar tipo de tarefa
 * @param {Function} props.buscarRegistrosIndividuais - Função para buscar registros individuais de uma tarefa
 * @param {Object} props.temposRealizadosPorTipoTarefa - Objeto com tempos realizados por tipo de tarefa ID (chave: tipoId, valor: tempoEmMs)
 * @param {Object} props.temposRealizadosPorTarefaPorTipoTarefa - Objeto com tempos realizados por tarefa dentro de cada tipo de tarefa (chave: tipoId, valor: { [tarefaId]: tempoEmMs })
 */
const TiposTarefaDetalhadosList = ({
    tiposTarefa,
    tiposTarefaExpandidos,
    registrosIndividuais,
    carregandoRegistros,
    formatarTempoEstimado,
    calcularCustoPorTempo,
    formatarValorMonetario,
    formatarDataHora,
    formatarTempoHMS,
    onToggleTipoTarefa,
    buscarRegistrosIndividuais,
    getNomeColaboradorPorUsuarioId = null,
    temposRealizadosPorTipoTarefa = {},
    temposRealizadosPorTarefaPorTipoTarefa = {}
}) => {
    const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());
    const [responsaveisExpandidos, setResponsaveisExpandidos] = useState(new Set());

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

    if (!tiposTarefa || tiposTarefa.length === 0) {
        return (
            <div className="tarefas-detalhadas-empty">
                <p>Nenhum tipo de tarefa encontrado</p>
            </div>
        );
    }

    const toggleTarefa = (tipoId, tarefaId, tarefa) => {
        const key = `${tipoId}-${tarefaId}`;
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
            {tiposTarefa.map((tipoT, index) => {
                const tipoId = String(tipoT.id);
                const isTipoExpanded = tiposTarefaExpandidos.has(tipoId);

                // Buscar tempo realizado do prop ou usar fallback
                const tempoRealizadoMs = temposRealizadosPorTipoTarefa[tipoId] || tipoT.tempoRealizado || 0;
                const tempoRealizadoFormatado = formatarTempoHMS
                    ? formatarTempoHMS(tempoRealizadoMs)
                    : (formatarTempoEstimado ? formatarTempoEstimado(tempoRealizadoMs, true) : '0s');

                const tempoEstimadoFormatado = formatarTempoEstimado
                    ? formatarTempoEstimado(tipoT.tempoEstimado || 0, true)
                    : '0s';

                // Calcular custo estimado (média se não houver responsável fixo)
                const custoEstimado = calcularCustoPorTempo && formatarValorMonetario
                    ? calcularCustoPorTempo(tipoT.tempoEstimado || 0, null)
                    : null;

                // Agrupar tarefas do tipo (se não estiverem agrupadas)
                const tarefasNoTipo = tipoT.tarefas || (() => {
                    const tarefasMap = new Map();
                    if (tipoT.registros) {
                        tipoT.registros.forEach(reg => {
                            if (!reg.tarefa_id) return;
                            const tId = String(reg.tarefa_id);
                            if (!tarefasMap.has(tId)) {
                                tarefasMap.set(tId, {
                                    id: tId,
                                    nome: reg.tarefa_nome || `Tarefa #${tId}`,
                                    tempoEstimado: 0,
                                    registros: []
                                });
                            }
                            const t = tarefasMap.get(tId);
                            t.tempoEstimado += (reg.tempo_estimado_dia || 0);
                            t.registros.push(reg);
                        });
                    }
                    return Array.from(tarefasMap.values());
                })();

                return (
                    <div
                        key={`tipo_${tipoId}_${index}`}
                        className="tarefa-detalhada-card tarefa-detalhada-card-nivel-1"
                    >
                        <div className="tarefa-detalhada-header">
                            <div className="tarefa-detalhada-info">
                                <div className="tarefa-detalhada-nome">
                                    <i className="fas fa-tags" style={{ marginRight: '8px' }}></i>
                                    {tipoT.nome}
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
                            {tarefasNoTipo.length > 0 && (
                                <button
                                    className="tarefa-detalhada-toggle"
                                    onClick={() => onToggleTipoTarefa(tipoId)}
                                    title={isTipoExpanded ? "Ocultar tarefas" : "Ver tarefas"}
                                >
                                    <i
                                        className={`fas fa-chevron-down ${isTipoExpanded ? 'expanded' : ''}`}
                                    ></i>
                                </button>
                            )}
                        </div>
                        {isTipoExpanded && tarefasNoTipo.length > 0 && (
                            <div className="tarefa-detalhada-registros">
                                <div className="tarefa-detalhada-registros-title">
                                    Tarefas ({tarefasNoTipo.length}):
                                </div>
                                <TarefasDetalhadasList
                                    tarefas={tarefasNoTipo}
                                    tarefasExpandidas={tarefasExpandidas}
                                    registrosIndividuais={registrosIndividuais}
                                    carregandoRegistros={carregandoRegistros}
                                    formatarTempoEstimado={formatarTempoEstimado}
                                    calcularCustoPorTempo={calcularCustoPorTempo}
                                    formatarValorMonetario={formatarValorMonetario}
                                    formatarDataHora={formatarDataHora}
                                    formatarTempoHMS={formatarTempoHMS}
                                    onToggleTarefa={(tipo_id, tarefa_id, tarefa) => toggleTarefa(tipoId, tarefa_id, tarefa)}
                                    buscarRegistrosIndividuais={buscarRegistrosIndividuais}
                                    getNomeColaboradorPorUsuarioId={getNomeColaboradorPorUsuarioId}
                                    temposRealizadosPorTarefa={temposRealizadosPorTarefaPorTipoTarefa[tipoId] || {}}
                                    filtrosAdicionais={{ tipo_tarefa_id: tipoId }}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default TiposTarefaDetalhadosList;
