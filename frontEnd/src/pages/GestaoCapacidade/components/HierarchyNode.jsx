import React, { useState, memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ICONE_POR_NIVEL, LABEL_POR_NIVEL, formatarMs, formatarMoeda } from '../../../services/gestaoCapacidadeAPI';
import { useToast } from '../../../hooks/useToast';

/**
 * Funções utilitárias locais
 */
const removerAcentos = (texto) => {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

/**
 * HierarchyNode — Componente recursivo para renderizar um nó da árvore hierárquica.
 */
const HierarchyNode = memo(function HierarchyNode({
    nodeId,
    nodeData,
    nivelAtual,
    proximosNiveis = [],
    depth = 0,
    iniciarExpandido = false,
    onToggleExpand = null,
    theme = depth === 0 ? 'card' : 'list',
    isActive = false,
}) {
    const [expandido, setExpandido] = useState(iniciarExpandido);
    const [hiddenChildren, setHiddenChildren] = useState(new Set());
    const [showFilterPopover, setShowFilterPopover] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0, openUp: false });

    const showToast = useToast();
    const lupaRef = useRef(null);
    const popoverRef = useRef(null);

    const toggleExpandir = useCallback((e) => {
        if (depth === 0 && onToggleExpand) {
            onToggleExpand(nodeId, nodeData, e);
        } else {
            setExpandido(prev => !prev);
        }
    }, [depth, onToggleExpand, nodeId, nodeData]);

    const handleCopyJSON = useCallback((e) => {
        e.stopPropagation();
        try {
            const jsonStr = JSON.stringify(nodeData, null, 2);
            navigator.clipboard.writeText(jsonStr);
            showToast('success', `JSON de ${nodeData.nome || nodeId} copiado!`);
        } catch (err) {
            console.error('Erro ao copiar JSON:', err);
            showToast('error', 'Falha ao copiar JSON');
        }
    }, [nodeData, nodeId, showToast]);

    const toggleFilter = useCallback((e) => {
        e.stopPropagation();
        if (!showFilterPopover && lupaRef.current) {
            const rect = lupaRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // Se tiver menos de 300px abaixo, abre para cima
            const shouldOpenUp = spaceBelow < 250;

            setPopoverCoords({
                top: shouldOpenUp ? rect.top : rect.bottom + 5,
                left: rect.right - 240, // Largura do popover definido no CSS é 240px
                openUp: shouldOpenUp
            });
        }
        setShowFilterPopover(prev => !prev);
    }, [showFilterPopover]);

    const toggleChildVisibility = useCallback((childId) => {
        setHiddenChildren(prev => {
            const next = new Set(prev);
            if (next.has(childId)) next.delete(childId);
            else next.add(childId);
            return next;
        });
    }, []);

    const selectAllChildren = useCallback(() => {
        setHiddenChildren(new Set());
    }, []);

    useEffect(() => {
        if (!showFilterPopover) return;
        const handleClickOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target) &&
                lupaRef.current && !lupaRef.current.contains(e.target)) {
                setShowFilterPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilterPopover]);

    if (!nodeData || typeof nodeData !== 'object') return null;

    const {
        nome = nodeId,
        total_estimado_ms = 0,
        total_realizado_ms = 0,
        total_estimado_hms,
        total_realizado_hms,
        custo_estimado,
        custo_realizado,
        total_tarefas,
        total_produtos,
        total_clientes,
        total_colaboradores,
        detalhes,
    } = nodeData;

    const temDetalhes = detalhes && typeof detalhes === 'object' && Object.keys(detalhes).length > 0;
    const proximoNivel = proximosNiveis[0] || null;
    const niveisRestantes = proximosNiveis.slice(1);
    const icone = ICONE_POR_NIVEL[nivelAtual] || 'fas fa-folder';
    const labelNivel = LABEL_POR_NIVEL[nivelAtual] || nivelAtual;

    // Métricas de filtragem
    const childrenKeys = temDetalhes ? Object.keys(detalhes) : [];
    const isFiltered = hiddenChildren.size > 0;
    const filteredChildren = useMemo(() => {
        if (!temDetalhes) return [];
        return Object.entries(detalhes).filter(([id]) => !hiddenChildren.has(id));
    }, [detalhes, hiddenChildren, temDetalhes]);

    const popoverOptions = useMemo(() => {
        if (!temDetalhes) return [];
        const query = removerAcentos(searchQuery);
        return Object.entries(detalhes)
            .map(([id, data]) => ({ id, nome: data.nome || id }))
            .filter(opt => !query || removerAcentos(opt.nome).includes(query))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [detalhes, searchQuery, temDetalhes]);

    // Formatar tempos
    const tempoEstimado = total_estimado_hms || formatarMs(total_estimado_ms);
    const tempoRealizado = total_realizado_hms || formatarMs(total_realizado_ms);

    // Calculo de novas métricas solicitadas
    // Saldo (Realizado) = Estimado - Realizado
    const saldo_realizado_ms = total_estimado_ms - total_realizado_ms;
    const custo_saldo_realizado = (custo_estimado || 0) - (custo_realizado || 0);

    // Saldo (Disponível) = Contratado - Estimado
    // Recuperar Contratado a partir de diferenca_ms (Contratado - Realizado) + Realizado ou usar horas_contratadas se disponível
    // Assumindo: diferenca_ms = Contratado - Realizado => Contratado = diferenca_ms + Realizado
    const contratado_ms_calc = nodeData.diferenca_ms !== undefined ? (nodeData.diferenca_ms + total_realizado_ms) : 0;
    const disponivel_ms = contratado_ms_calc - total_estimado_ms;

    // Custo disponível = Contratado - Estimado
    const custo_contratado_local = nodeData.custo_contratado || 0;
    const custo_disponivel = custo_contratado_local - (custo_estimado || 0);

    if (theme === 'list') {
        return (
            <div className={`tree-node tree-node-depth-${depth} ${expandido ? 'is-expanded' : ''}`}>
                <div
                    className={`tree-node-content ${temDetalhes ? 'clickable' : ''}`}
                    onClick={temDetalhes ? toggleExpandir : undefined}
                >
                    <div className="tree-node-main-row">
                        {temDetalhes && (
                            <div className="tree-node-toggle">
                                <i className={`fas fa-caret-right ${expandido ? 'expanded' : ''}`}></i>
                            </div>
                        )}
                        {!temDetalhes && <div className="tree-node-spacer" />}

                        <div className="tree-node-info">
                            <i className={`${icone} tree-node-icon`}></i>
                            <span className="tree-node-name">{nome}</span>
                            {nodeId === 'sem-responsavel' && (
                                <span className="tree-node-badge-alert" style={{ marginLeft: '8px', fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                                    ESTIMATIVA GERAL
                                </span>
                            )}
                        </div>

                        <div className="tree-node-actions">
                            {temDetalhes && (
                                <div
                                    className={`node-action-btn ${isFiltered ? 'active' : ''}`}
                                    onClick={toggleFilter}
                                    ref={lupaRef}
                                    title="Filtrar descendentes"
                                >
                                    <i className="fas fa-search"></i>
                                    {isFiltered && <span className="node-action-badge"></span>}

                                    {showFilterPopover && createPortal(
                                        <div
                                            className="hierarchy-filter-popover"
                                            ref={popoverRef}
                                            onClick={e => e.stopPropagation()}
                                            style={{
                                                position: 'fixed',
                                                top: `${popoverCoords.top}px`,
                                                left: `${popoverCoords.left}px`,
                                                zIndex: 9999,
                                                transform: popoverCoords.openUp ? 'translateY(-100%) translateY(-35px)' : 'none'
                                            }}
                                        >
                                            <div className="hfp-search-wrapper">
                                                <input
                                                    type="text"
                                                    className="hfp-search-input"
                                                    placeholder="Buscar item..."
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="hfp-options">
                                                {popoverOptions.map(opt => (
                                                    <div
                                                        key={opt.id}
                                                        className={`hfp-option ${!hiddenChildren.has(opt.id) ? 'selected' : ''}`}
                                                        onClick={() => toggleChildVisibility(opt.id)}
                                                    >
                                                        <div className="hfp-option-checkbox">
                                                            {!hiddenChildren.has(opt.id) && <i className="fas fa-check"></i>}
                                                        </div>
                                                        <span>{opt.nome}</span>
                                                    </div>
                                                ))}
                                                {popoverOptions.length === 0 && <div className="hfp-empty">Nenhum item encontrado</div>}
                                            </div>
                                            <div className="hfp-footer">
                                                <button className="hfp-btn-link" onClick={selectAllChildren}>Selecionar Todos</button>
                                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                    {childrenKeys.length - hiddenChildren.size}/{childrenKeys.length}
                                                </span>
                                            </div>
                                        </div>,
                                        document.body
                                    )}
                                </div>
                            )}
                            <div className="node-action-btn" onClick={handleCopyJSON} title="Copiar JSON">
                                <i className="fas fa-code"></i>
                            </div>
                        </div>
                    </div>

                    <div className="tree-node-body">
                        <div className="tree-node-metrics">
                            <div
                                className="tree-metric-card estimado"
                                title={`Estimado: ${tempoEstimado}${custo_estimado != null ? ` | ${formatarMoeda(custo_estimado)}` : ''}`}
                            >
                                <i className="fas fa-clock"></i>
                                <span className="tree-metric-time">{tempoEstimado}</span>
                                {custo_estimado != null && (
                                    <>
                                        <span className="tree-metric-separator">|</span>
                                        <span className="tree-metric-value">{formatarMoeda(custo_estimado)}</span>
                                    </>
                                )}
                            </div>
                            <div
                                className="tree-metric-card realizado"
                                title={`Realizado: ${tempoRealizado}${custo_realizado != null ? ` | ${formatarMoeda(custo_realizado)}` : ''}`}
                            >
                                <i className="fas fa-play-circle"></i>
                                <span className="tree-metric-time">{tempoRealizado}</span>
                                {custo_realizado != null && (
                                    <>
                                        <span className="tree-metric-separator">|</span>
                                        <span className="tree-metric-value">{formatarMoeda(custo_realizado)}</span>
                                    </>
                                )}
                            </div>
                            {nodeData.horas_contratadas_hms && (
                                <div
                                    className="tree-metric-card contratadas"
                                    title={`Horas Contratadas: ${nodeData.horas_contratadas_hms}${nodeData.custo_contratado != null ? ` | ${formatarMoeda(nodeData.custo_contratado)}` : ''}`}
                                >
                                    <i className="fas fa-file-contract"></i>
                                    <span className="tree-metric-time">{nodeData.horas_contratadas_hms}</span>
                                    {nodeData.custo_contratado != null && (
                                        <>
                                            <span className="tree-metric-separator">|</span>
                                            <span className="tree-metric-value">{formatarMoeda(nodeData.custo_contratado)}</span>
                                        </>
                                    )}
                                </div>
                            )}
                            {/* Disponível = Contratado - Estimado */}
                            {nodeData.diferenca_hms && (
                                <div
                                    className={`tree-metric-card ${disponivel_ms < 0 ? 'saldo-negativo' : 'saldo-positivo'}`}
                                    title={`Disponível (Contratadas - Estimado): ${formatarMs(disponivel_ms)}${nodeData.custo_contratado != null ? ` | ${formatarMoeda(custo_disponivel)}` : ''}`}
                                >
                                    <i className="fas fa-balance-scale"></i>
                                    <span className="tree-metric-label-small">Disp:</span>
                                    <span className="tree-metric-time">{formatarMs(disponivel_ms)}</span>
                                    {nodeData.custo_contratado != null && (
                                        <>
                                            <span className="tree-metric-separator">|</span>
                                            <span className="tree-metric-value">{formatarMoeda(custo_disponivel)}</span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Saldo (Realizado) = Estimado - Realizado */}
                            <div
                                className={`tree-metric-card ${saldo_realizado_ms < 0 ? 'saldo-negativo' : 'saldo-positivo'}`}
                                title={`Saldo (Realizado) (Estimado - Realizado): ${formatarMs(saldo_realizado_ms)}${custo_estimado != null && custo_realizado != null ? ` | ${formatarMoeda(custo_saldo_realizado)}` : ''}`}
                            >
                                <i className="fas fa-piggy-bank"></i>
                                <span className="tree-metric-label-small">Saldo:</span>
                                <span className="tree-metric-time">{formatarMs(saldo_realizado_ms)}</span>
                                {custo_estimado != null && custo_realizado != null && (
                                    <>
                                        <span className="tree-metric-separator">|</span>
                                        <span className="tree-metric-value">{formatarMoeda(custo_saldo_realizado)}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {temDetalhes && expandido && proximoNivel && (
                    <div className="tree-node-children">
                        {filteredChildren.map(([childId, childData]) => (
                            <HierarchyNode
                                key={childId}
                                nodeId={childId}
                                nodeData={childData}
                                nivelAtual={proximoNivel}
                                proximosNiveis={niveisRestantes}
                                depth={depth + 1}
                                theme="list"
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Renderização original (depth 0 / theme="card")
    const isResponsavel = nivelAtual === 'colaborador' || nivelAtual === 'responsavel';

    // Cálculos para a barra
    let totalBarra = 1;
    let pctEstimado = 0;
    let pctRealizado = 0;

    if (isResponsavel) {
        // Base: Contratada (se disponível, senão Estimado)
        totalBarra = Math.max(contratado_ms_calc, total_estimado_ms, total_realizado_ms, 1);
        // Estimado preenche o Contratado (Azul)
        pctEstimado = Math.min(100, (total_estimado_ms / totalBarra) * 100);
        // Realizado preenche o Estimado (Laranja) - visualmente sobreposto
        pctRealizado = Math.min(100, (total_realizado_ms / totalBarra) * 100);
    } else {
        // Base: Estimado
        // "a barra deve ser o total dela como estimado(na cor azul)"
        totalBarra = Math.max(total_estimado_ms, 1);
        pctEstimado = 100; // Barra azul ocupa tudo (é o container)
        // "o realizado dela em laranja, entao ... vai preenchendo"
        pctRealizado = Math.min(100, (total_realizado_ms / totalBarra) * 100);
    }

    const stats = [];
    if (total_tarefas != null) stats.push({ icon: 'fas fa-list', label: 'Tarefas', value: total_tarefas });
    if (total_clientes != null) stats.push({ icon: 'fas fa-briefcase', label: 'Clientes', value: total_clientes });
    if (total_produtos != null) stats.push({ icon: 'fas fa-box', label: 'Produtos', value: total_produtos });
    if (total_colaboradores != null) stats.push({ icon: 'fas fa-user-tie', label: 'Responsáveis', value: total_colaboradores });

    return (
        <div
            className={`hierarchy-node hierarchy-node-depth-${Math.min(depth, 4)} ${isActive ? 'hierarchy-node-active-root' : ''}`}
            style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 16}px` : 0 }}
        >
            <div className="tempo-disponivel-card">
                {/* Header */}
                <div
                    className={`tempo-disponivel-card-header sem-avatar hierarchy-node-header ${temDetalhes ? 'clickable' : ''}`}
                    onClick={temDetalhes ? toggleExpandir : undefined}
                    role={temDetalhes ? 'button' : undefined}
                >
                    <div className="tempo-disponivel-card-nome-wrapper sem-avatar">
                        <i className={icone} style={{ marginRight: '8px', opacity: 0.7, fontSize: '14px' }}></i>
                        <span className="tempo-disponivel-card-nome">{nome}</span>
                        {nodeId === 'sem-responsavel' && (
                            <span className="painel-usuario-estimado-pill" style={{ marginLeft: '8px', fontSize: '11px', background: '#fee2e2', color: '#b91c1c' }}>
                                Sem Responsável
                            </span>
                        )}
                        {depth === 0 && nodeId !== 'sem-responsavel' && (
                            <span className="painel-usuario-estimado-pill" style={{ marginLeft: '8px', fontSize: '11px' }}>
                                {labelNivel}
                            </span>
                        )}
                        {nodeData.tipo_contrato_nome && (
                            <span className="painel-usuario-estimado-pill" style={{ marginLeft: '8px', fontSize: '11px', background: '#f3f4f6', color: '#374151' }}>
                                {nodeData.tipo_contrato_nome}
                            </span>
                        )}
                    </div>
                    {temDetalhes && (
                        <span className="hierarchy-node-chevron">
                            <i className="fas fa-chevron-right"></i>
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="tempo-disponivel-card-content">
                    {/* Stats */}
                    {stats.length > 0 && (
                        <div className="tempo-disponivel-card-stats">
                            {stats.map(s => (
                                <div key={s.label} className="tempo-disponivel-stat-item">
                                    <i className={s.icon}></i>
                                    <span>{s.label}: {s.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Barra de Progresso */}
                    <div className="barra-progresso-tempo">
                        <div className="barra-progresso-tempo-range" style={{ backgroundColor: isResponsavel ? '#e5e7eb' : undefined }}> {/* Fundo cinza se for contratada */}
                            <div
                                className="barra-progresso-tempo-fill estimado"
                                style={{ width: `${pctEstimado}%`, left: '0%', zIndex: 1 }}
                                title={`Estimado: ${tempoEstimado}`}
                            ></div>
                            <div
                                className="barra-progresso-tempo-fill realizado"
                                style={{ width: `${pctRealizado}%`, left: '0%', zIndex: 2 }}
                                title={`Realizado: ${tempoRealizado}`}
                            ></div>
                        </div>
                        <div className="barra-progresso-tempo-legenda">
                            <div className="barra-progresso-tempo-item">
                                <div className="barra-progresso-tempo-item-content">
                                    <div className="barra-progresso-tempo-item-header" title={`Estimado: ${tempoEstimado}${custo_estimado != null ? ` | ${formatarMoeda(custo_estimado)}` : ''}`}>
                                        <i className="fas fa-clock painel-colaborador-estimado-icon-inline"></i>
                                        <span className="barra-progresso-tempo-label">Estimado</span>
                                    </div>
                                    <div className="barra-progresso-tempo-badge-wrapper">
                                        <span className="barra-progresso-tempo-badge estimado">
                                            <span className="barra-progresso-tempo-badge-tempo">{tempoEstimado}</span>
                                        </span>
                                        {custo_estimado != null && (
                                            <span className="barra-progresso-tempo-custo estimado">
                                                {formatarMoeda(custo_estimado)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="barra-progresso-tempo-item">
                                <div className="barra-progresso-tempo-item-content">
                                    <div className="barra-progresso-tempo-item-header" title={`Realizado: ${tempoRealizado}${custo_realizado != null ? ` | ${formatarMoeda(custo_realizado)}` : ''}`}>
                                        <i className="fas fa-play-circle painel-colaborador-realizado-icon-inline"></i>
                                        <span className="barra-progresso-tempo-label">Realizado</span>
                                    </div>
                                    <div className="barra-progresso-tempo-badge-wrapper">
                                        <span className="barra-progresso-tempo-badge realizado">
                                            <span className="barra-progresso-tempo-badge-tempo">{tempoRealizado}</span>
                                        </span>
                                        {custo_realizado != null && (
                                            <span className="barra-progresso-tempo-custo realizado">
                                                {formatarMoeda(custo_realizado)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Horas Contratadas (Apenas se disponível, ex: Colaborador) */}
                            {nodeData.horas_contratadas_hms && (
                                <div className="barra-progresso-tempo-item">
                                    <div className="barra-progresso-tempo-item-content">
                                        <div className="barra-progresso-tempo-item-header" title={`Horas Contratadas no Período: ${nodeData.horas_contratadas_hms}${nodeData.custo_contratado != null ? ` | ${formatarMoeda(nodeData.custo_contratado)}` : ''}`}>
                                            <i className="fas fa-file-contract" style={{ color: '#6b7280', fontSize: '12px' }}></i>
                                            <span className="barra-progresso-tempo-label">Contratadas</span>
                                        </div>
                                        <div className="barra-progresso-tempo-badge-wrapper">
                                            <span className="barra-progresso-tempo-badge contratadas" style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
                                                <span className="barra-progresso-tempo-badge-tempo">{nodeData.horas_contratadas_hms}</span>
                                            </span>
                                            {nodeData.custo_contratado != null ? (
                                                <span className="barra-progresso-tempo-custo contratadas" style={{ color: '#6b7280' }}>
                                                    {formatarMoeda(nodeData.custo_contratado)}
                                                </span>
                                            ) : (
                                                <span className="barra-progresso-tempo-custo-placeholder" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Disponível (Contratadas - Estimado) */}
                            {nodeData.diferenca_hms && (
                                <div className="barra-progresso-tempo-item">
                                    <div className="barra-progresso-tempo-item-content">
                                        <div className="barra-progresso-tempo-item-header" title={`Disponível (Contratadas - Estimado): ${formatarMs(disponivel_ms)}${nodeData.custo_contratado != null ? ` | ${formatarMoeda(custo_disponivel)}` : ''}`}>
                                            <i className="fas fa-balance-scale" style={{ color: disponivel_ms < 0 ? '#ef4444' : '#10b981', fontSize: '12px' }}></i>
                                            <span className="barra-progresso-tempo-label">Disponível</span>
                                        </div>
                                        <div className="barra-progresso-tempo-badge-wrapper">
                                            <span className={`barra-progresso-tempo-badge ${disponivel_ms < 0 ? 'saldo-negativo' : 'saldo-positivo'}`}>
                                                <span className="barra-progresso-tempo-badge-tempo">{formatarMs(disponivel_ms)}</span>
                                            </span>
                                            {nodeData.custo_contratado != null ? (
                                                <span className={`barra-progresso-tempo-custo ${disponivel_ms < 0 ? 'saldo-negativo' : 'saldo-positivo'}`}>
                                                    {formatarMoeda(custo_disponivel)}
                                                </span>
                                            ) : (
                                                <span className="barra-progresso-tempo-custo-placeholder" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Saldo (Realizado) extra removido conforme pedido */}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filhos (recursivo) */}
            {temDetalhes && expandido && proximoNivel && !onToggleExpand && (
                <div className="hierarchy-node-children">
                    {filteredChildren.map(([childId, childData]) => (
                        <HierarchyNode
                            key={childId}
                            nodeId={childId}
                            nodeData={childData}
                            nivelAtual={proximoNivel}
                            proximosNiveis={niveisRestantes}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

export default HierarchyNode;
