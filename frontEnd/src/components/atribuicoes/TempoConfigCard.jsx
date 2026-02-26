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
        // Inicializar para responsáveis que não têm config
        responsaveis.forEach(respId => {
            const idStr = String(respId);
            if (!config[idStr] || !Array.isArray(config[idStr]) || config[idStr].length === 0) {
                config[idStr] = [
                    { tempo_minutos: 0, data_inicio: dataInicioPadrao || new Date().toISOString().split('T')[0] }
                ];
            }
        });
        return config;
    });

    const getColaboradorNome = (id) => {
        const colab = colaboradores.find(c => String(c.id) === String(id));
        return colab ? colab.nome : `Responsável ${id}`;
    };

    const handleAddSegment = (respId) => {
        const idStr = String(respId);
        setTempoConfig(prev => ({
            ...prev,
            [idStr]: [
                ...prev[idStr],
                { tempo_minutos: 0, data_inicio: '' }
            ]
        }));
    };

    const handleRemoveSegment = (respId, index) => {
        const idStr = String(respId);
        if (tempoConfig[idStr].length <= 1) return; // Não remove o último segment

        setTempoConfig(prev => ({
            ...prev,
            [idStr]: prev[idStr].filter((_, i) => i !== index)
        }));
    };

    const handleChangeSegment = (respId, index, field, value) => {
        const idStr = String(respId);
        setTempoConfig(prev => {
            const newSegments = [...prev[idStr]];
            newSegments[index] = { ...newSegments[index], [field]: field === 'tempo_minutos' ? parseInt(value) || 0 : value };
            return { ...prev, [idStr]: newSegments };
        });
    };

    const handleSaveInternal = () => {
        // Validações básicas
        for (const [respId, segments] of Object.entries(tempoConfig)) {
            if (responsaveis.map(String).includes(respId)) {
                // Verificar datas vazias
                if (segments.some(s => !s.data_inicio)) {
                    alert('Preencha todas as datas de início.');
                    return;
                }

                // Verificar datas duplicadas para o mesmo responsável
                const dates = segments.map(s => s.data_inicio);
                if (new Set(dates).size !== dates.length) {
                    alert(`Datas duplicadas para o colaborador ${getColaboradorNome(respId)}.`);
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
                    <p className="empty-message">Selecione pelo menos um responsável primeiro.</p>
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
                <button className="btn-save" onClick={handleSaveInternal} disabled={responsaveisAtivos.length === 0}>
                    Confirmar Configuração
                </button>
            </div>
        </div>
    );
};

export default TempoConfigCard;
