import React, { useState, memo, useCallback } from 'react';
import { ICONE_POR_NIVEL, LABEL_POR_NIVEL, formatarMs, formatarMoeda } from '../../../services/gestaoCapacidadeAPI';

/**
 * HierarchyNode — Componente recursivo para renderizar um nó da árvore hierárquica.
 *
 * Cada nó pode conter `detalhes` (filhos), que são renderizados como HierarchyNode recursivamente.
 * Usa as mesmas classes CSS do sistema legado para manter visual consistente.
 *
 * Props:
 *   nodeId          - Chave do nó (ex: "123")
 *   nodeData        - Dados do nó { nome, total_estimado_ms, total_realizado_ms, custo_estimado, custo_realizado, detalhes, ... }
 *   nivelAtual      - Nome do nível atual (ex: 'colaborador', 'cliente')
 *   proximosNiveis  - Array com os níveis abaixo (ex: ['produto', 'tarefa'])
 *   depth           - Profundidade (0 = raiz) — usada para indentação
 *   iniciarExpandido - Se deve iniciar expandido (default: false)
 */
const HierarchyNode = memo(function HierarchyNode({
    nodeId,
    nodeData,
    nivelAtual,
    proximosNiveis = [],
    depth = 0,
    iniciarExpandido = false,
}) {
    const [expandido, setExpandido] = useState(iniciarExpandido);
    const toggleExpandir = useCallback(() => setExpandido(prev => !prev), []);

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

    // Calcular barra de progresso simples (estimado vs realizado)
    const totalBarra = Math.max(total_estimado_ms, total_realizado_ms, 1);
    const pctEstimado = Math.min(100, (total_estimado_ms / totalBarra) * 100);
    const pctRealizado = Math.min(100, (total_realizado_ms / totalBarra) * 100);

    // Formatar tempos
    const tempoEstimado = total_estimado_hms || formatarMs(total_estimado_ms);
    const tempoRealizado = total_realizado_hms || formatarMs(total_realizado_ms);

    // Montar estatísticas (contagens)
    const stats = [];
    if (total_tarefas != null) stats.push({ icon: 'fas fa-list', label: 'Tarefas', value: total_tarefas });
    if (total_clientes != null) stats.push({ icon: 'fas fa-briefcase', label: 'Clientes', value: total_clientes });
    if (total_produtos != null) stats.push({ icon: 'fas fa-box', label: 'Produtos', value: total_produtos });
    if (total_colaboradores != null) stats.push({ icon: 'fas fa-user-tie', label: 'Responsáveis', value: total_colaboradores });

    return (
        <div
            className={`hierarchy-node hierarchy-node-depth-${Math.min(depth, 4)}`}
            style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 16}px` : 0 }}
        >
            <div className="tempo-disponivel-card">
                {/* Header */}
                <div
                    className={`tempo-disponivel-card-header sem-avatar hierarchy-node-header ${temDetalhes ? 'clickable' : ''}`}
                    onClick={temDetalhes ? toggleExpandir : undefined}
                    role={temDetalhes ? 'button' : undefined}
                    tabIndex={temDetalhes ? 0 : undefined}
                    onKeyDown={temDetalhes ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpandir(); } } : undefined}
                >
                    <div className="tempo-disponivel-card-nome-wrapper sem-avatar">
                        <i className={icone} style={{ marginRight: '8px', opacity: 0.7, fontSize: '14px' }}></i>
                        <span className="tempo-disponivel-card-nome">{nome}</span>
                        {depth === 0 && (
                            <span className="painel-usuario-estimado-pill" style={{ marginLeft: '8px', fontSize: '11px' }}>
                                {labelNivel}
                            </span>
                        )}
                    </div>
                    {temDetalhes && (
                        <span className="hierarchy-node-chevron" style={{
                            transition: 'transform 0.2s ease',
                            transform: expandido ? 'rotate(90deg)' : 'rotate(0deg)',
                            fontSize: '12px',
                            color: '#6b7280',
                            marginLeft: 'auto',
                            paddingLeft: '8px',
                        }}>
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
                        <div className="barra-progresso-tempo-range">
                            <div
                                className="barra-progresso-tempo-fill estimado"
                                style={{ width: `${pctEstimado}%`, left: '0%' }}
                                title={`Estimado: ${tempoEstimado}`}
                            ></div>
                            <div
                                className="barra-progresso-tempo-fill realizado"
                                style={{ width: `${pctRealizado}%`, left: `${pctEstimado}%` }}
                                title={`Realizado: ${tempoRealizado}`}
                            ></div>
                        </div>
                        <div className="barra-progresso-tempo-legenda">
                            <div className="barra-progresso-tempo-item">
                                <div className="barra-progresso-tempo-item-content">
                                    <div className="barra-progresso-tempo-item-header">
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
                                    <div className="barra-progresso-tempo-item-header">
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
                        </div>
                    </div>
                </div>
            </div>

            {/* Filhos (recursivo) */}
            {temDetalhes && expandido && proximoNivel && (
                <div className="hierarchy-node-children">
                    {Object.entries(detalhes).map(([childId, childData]) => (
                        <HierarchyNode
                            key={childId}
                            nodeId={childId}
                            nodeData={childData}
                            nivelAtual={proximoNivel}
                            proximosNiveis={niveisRestantes}
                            depth={depth + 1}
                            iniciarExpandido={false}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

export default HierarchyNode;
