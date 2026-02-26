import React, { useState, useEffect } from 'react';
import './TempoConfigCard.css';

const TempoConfigCard = ({
    responsaveis = [],
    colaboradores = [],
    initialConfig = {},
    onSave,
    onClose,
    dataInicioPadrao = null
}) => {
    // Garantir que temos um estado local com a estrutura correta
    const [tempoConfig, setTempoConfig] = useState(() => {
        const config = { ...initialConfig };

        // Se não houver responsáveis, garantir inicialização da chave 'null' (Structural)
        if (!responsaveis || responsaveis.length === 0) {
            if (!config['null'] || !Array.isArray(config['null'])) {
                config['null'] = [
                    { tempo_minutos: 0, data_inicio: dataInicioPadrao || new Date().toISOString().split('T')[0] }
                ];
            }
        } else {
            // Inicializar para responsáveis que não têm config
            responsaveis.forEach(respId => {
                const idStr = String(respId);
                if (!config[idStr] || !Array.isArray(config[idStr]) || config[idStr].length === 0) {
                    config[idStr] = [
                        { tempo_minutos: 0, data_inicio: dataInicioPadrao || new Date().toISOString().split('T')[0] }
                    ];
                }
            });
        }
        return config;
    });

    const getColaboradorNome = (id) => {
        if (id === 'null' || id === null) return 'Estimativa Geral (Sem Responsável)';
        const colab = colaboradores.find(c => String(c.id) === String(id));
        return colab ? colab.nome : `Responsável ${id}`;
    };

    const handleAddSegment = (respId) => {
        const idStr = String(respId);
        setTempoConfig(prev => {
            const currentSegments = prev[idStr] || [{ tempo_minutos: 0, data_inicio: dataInicioPadrao || new Date().toISOString().split('T')[0] }];
            return {
                ...prev,
                [idStr]: [
                    ...currentSegments,
                    { tempo_minutos: 0, data_inicio: '' }
                ]
            };
        });
    };

    const handleRemoveSegment = (respId, index) => {
        const idStr = String(respId);
        if (!tempoConfig[idStr] || tempoConfig[idStr].length <= 1) return; // Não remove o último segment

        setTempoConfig(prev => ({
            ...prev,
            [idStr]: prev[idStr].filter((_, i) => i !== index)
        }));
    };

    const handleChangeSegment = (respId, index, field, value) => {
        const idStr = String(respId);
        setTempoConfig(prev => {
            const currentSegments = prev[idStr] || [{ tempo_minutos: 0, data_inicio: dataInicioPadrao || new Date().toISOString().split('T')[0] }];
            const newSegments = [...currentSegments];
            newSegments[index] = { ...newSegments[index], [field]: field === 'tempo_minutos' ? parseInt(value) || 0 : value };
            return { ...prev, [idStr]: newSegments };
        });
    };

    const handleSaveInternal = () => {
        // Validações básicas
        const keysToValidate = responsaveis.length > 0 ? responsaveis.map(String) : ['null'];
        for (const respId of keysToValidate) {
            const segments = tempoConfig[respId];
            if (segments) {
                // Verificar datas vazias
                if (segments.some(s => !s.data_inicio)) {
                    alert('Preencha todas as datas de início.');
                    return;
                }

                // Verificar datas duplicadas para o mesmo responsável
                const dates = segments.map(s => s.data_inicio);
                if (new Set(dates).size !== dates.length) {
                    alert(`Datas duplicadas para ${getColaboradorNome(respId)}.`);
                    return;
                }
            }
        }

        onSave(tempoConfig);
    };

    // Filtrar apenas responsáveis que ainda estão selecionados
    const responsaveisAtivos = responsaveis.map(String);

    return (
        <div className="tempo-config-popover">
            <div className="tempo-config-header">
                <h4><i className="fas fa-cog"></i> Configurar Tempo</h4>
                <button className="close-btn" onClick={onClose}>&times;</button>
            </div>

            <div className="tempo-config-body">
                {responsaveisAtivos.length === 0 ? (
                    (() => {
                        // Se não houver responsáveis, mostrar a configuração para o 'null'
                        const respId = 'null';
                        return (
                            <div key={respId} className="responsavel-tempo-group structural-config">
                                <div className="responsavel-name-row">
                                    <i className="fas fa-layer-group"></i>
                                    <span>Estimativa Geral (Estrutural)</span>
                                </div>
                                <div className="segments-list">
                                    {(tempoConfig[respId] || [{ tempo_minutos: 0, data_inicio: dataInicioPadrao || new Date().toISOString().split('T')[0] }]).map((segment, index) => (
                                        <div key={index} className="tempo-segment-row">
                                            <div className="segment-input-group">
                                                <label>Tempo (minutos)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={segment.tempo_minutos}
                                                    onChange={(e) => handleChangeSegment(respId, index, 'tempo_minutos', e.target.value)}
                                                    placeholder="Minutos"
                                                />
                                            </div>
                                            <div className="segment-input-group">
                                                <label>A partir de</label>
                                                <input
                                                    type="date"
                                                    value={segment.data_inicio}
                                                    onChange={(e) => handleChangeSegment(respId, index, 'data_inicio', e.target.value)}
                                                />
                                            </div>
                                            {index > 0 && (
                                                <button
                                                    className="remove-segment-btn"
                                                    onClick={() => handleRemoveSegment(respId, index)}
                                                    title="Remover mudança"
                                                >
                                                    <i className="fas fa-trash-alt"></i>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button className="add-segment-btn" onClick={() => handleAddSegment(respId)}>
                                    <i className="fas fa-plus"></i> Adicionar mudança de estimativa
                                </button>
                            </div>
                        );
                    })()
                ) : (
                    responsaveisAtivos.map(respId => (
                        <div key={respId} className="responsavel-tempo-group">
                            <div className="responsavel-name-row">
                                <i className="fas fa-user-circle"></i>
                                <span>{getColaboradorNome(respId)}</span>
                            </div>

                            <div className="segments-list">
                                {(tempoConfig[respId] || []).map((segment, index) => (
                                    <div key={index} className="tempo-segment-row">
                                        <div className="segment-input-group">
                                            <label>Tempo (minutos)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={segment.tempo_minutos}
                                                onChange={(e) => handleChangeSegment(respId, index, 'tempo_minutos', e.target.value)}
                                                placeholder="Minutos"
                                            />
                                        </div>
                                        <div className="segment-input-group">
                                            <label>A partir de</label>
                                            <input
                                                type="date"
                                                value={segment.data_inicio}
                                                onChange={(e) => handleChangeSegment(respId, index, 'data_inicio', e.target.value)}
                                            />
                                        </div>
                                        {index > 0 && (
                                            <button
                                                className="remove-segment-btn"
                                                onClick={() => handleRemoveSegment(respId, index)}
                                                title="Remover mudança"
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                className="add-segment-btn"
                                onClick={() => handleAddSegment(respId)}
                            >
                                <i className="fas fa-plus"></i> Adicionar mudança de tempo
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="tempo-config-footer">
                <button className="btn-cancel" onClick={onClose}>Cancelar</button>
                <button className="btn-save" onClick={handleSaveInternal}>
                    Confirmar Configuração
                </button>
            </div>
        </div>
    );
};

export default TempoConfigCard;
