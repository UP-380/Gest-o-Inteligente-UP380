import React, { useState, useRef, useEffect } from 'react';
import './TempoConfigCard.css';

const parseMinutesToHHMM = (totalMinutes) => {
    const hours = Math.floor(Number(totalMinutes || 0) / 60);
    const minutes = Number(totalMinutes || 0) % 60;
    return { hours, minutes };
};

const TempoConfigCard = ({
    initialConfig = {},
    onSave,
    onClose,
    dataInicioPadrao = null,
    responsavelId = null
}) => {
    const cardRef = useRef(null);
    const [positionUp, setPositionUp] = useState(false);

    useEffect(() => {
        if (cardRef.current && cardRef.current.parentElement) {
            const parentRect = cardRef.current.parentElement.getBoundingClientRect();
            const vh = window.innerHeight;
            const spaceBelow = vh - parentRect.bottom;
            const spaceAbove = parentRect.top;

            // Se o espaço abaixo for insuficiente para o card (max 450px, mas 400px é um bom limiar)
            // e houver mais espaço acima, abrimos para cima
            if (spaceBelow < 400 && spaceAbove > spaceBelow) {
                setPositionUp(true);
            }
        }
    }, []);
    // Garantimos que o estado é uma lista genérica de segmentos de tempo atrelados à Tarefa.
    // Ignoramos completamente os 'responsaveis' (a chave 'null' garante a compatibilidade com o formato esperado pelo payload do backend = estimativa estrutural/geral).
    const [segments, setSegments] = useState(() => {
        // Tenta achar qualquer segmento preexistente (seja em "null" ou que sobrou de um antigo ID de responsável)
        const allKeys = Object.keys(initialConfig);
        if (allKeys.length > 0 && Array.isArray(initialConfig[allKeys[0]]) && initialConfig[allKeys[0]].length > 0) {
            return [...initialConfig[allKeys[0]]];
        }

        return [
            { tempo_minutos: 0, data_inicio: dataInicioPadrao || new Date().toISOString().split('T')[0] }
        ];
    });

    const handleAddSegment = () => {
        setSegments(prev => [
            ...prev,
            { tempo_minutos: 0, data_inicio: '' }
        ]);
    };

    const handleRemoveSegment = (index) => {
        if (segments.length <= 1) return;
        setSegments(prev => prev.filter((_, i) => i !== index));
    };

    const handleChangeTime = (index, fieldStr, value) => {
        setSegments(prev => {
            const newSegments = [...prev];
            const current = parseMinutesToHHMM(newSegments[index].tempo_minutos);

            let newHours = current.hours;
            let newMins = current.minutes;

            if (fieldStr === 'h') newHours = parseInt(value) || 0;
            if (fieldStr === 'm') newMins = parseInt(value) || 0;

            newSegments[index] = {
                ...newSegments[index],
                tempo_minutos: (newHours * 60) + newMins
            };
            return newSegments;
        });
    };

    const handleChangeDate = (index, value) => {
        setSegments(prev => {
            const newSegments = [...prev];
            newSegments[index] = { ...newSegments[index], data_inicio: value };
            return newSegments;
        });
    };

    const handleSaveInternal = () => {
        // Validar datas vazias
        if (segments.some(s => !s.data_inicio)) {
            alert('Preencha todas as datas de início.');
            return;
        }

        // Validar datas duplicadas
        const dates = segments.map(s => s.data_inicio);
        if (new Set(dates).size !== dates.length) {
            alert('Você não pode ter datas de início duplicadas para a mesma tarefa.');
            return;
        }

        // Retorna no formato estrutural {'null': [...]}; se houver um responsável único, também vincula a ele
        const payload = { 'null': segments };
        if (responsavelId != null && responsavelId !== '') {
            payload[String(responsavelId)] = segments;
        }
        onSave(payload);
    };

    return (
        <div ref={cardRef} className={`tempo-config-popover ${positionUp ? 'position-up' : ''}`}>
            <div className="tempo-config-header">
                <h4><i className="fas fa-clock"></i> Configurar Estimativa</h4>
                <button className="close-btn" onClick={onClose}>&times;</button>
            </div>

            <div className="tempo-config-body">
                <div className="responsavel-tempo-group structural-config">
                    <div className="responsavel-name-row" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                        <i className="fas fa-layer-group"></i>
                        <span style={{ fontWeight: 600 }}>Estimativa Geral da Tarefa</span>
                    </div>
                    <div className="segments-list">
                        {segments.map((segment, index) => {
                            const { hours, minutes } = parseMinutesToHHMM(segment.tempo_minutos);
                            return (
                                <div key={index} className="tempo-segment-row">
                                    <div className="segment-input-group time-hhmm-group">
                                        <label>Tempo Estimado</label>
                                        <div className="hhmm-inputs">
                                            <input
                                                type="number"
                                                min="0"
                                                className="time-input-hh"
                                                value={hours || ''}
                                                onChange={(e) => handleChangeTime(index, 'h', e.target.value)}
                                                placeholder="00h"
                                            />
                                            <span>:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                className="time-input-mm"
                                                value={minutes || ''}
                                                onChange={(e) => handleChangeTime(index, 'm', e.target.value)}
                                                placeholder="00m"
                                            />
                                        </div>
                                    </div>
                                    <div className="segment-input-group">
                                        <label>A partir de</label>
                                        <input
                                            type="date"
                                            value={segment.data_inicio}
                                            onChange={(e) => handleChangeDate(index, e.target.value)}
                                        />
                                    </div>
                                    {index > 0 && (
                                        <button
                                            className="remove-segment-btn"
                                            onClick={() => handleRemoveSegment(index)}
                                            title="Remover mudança"
                                        >
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <button className="add-segment-btn" onClick={handleAddSegment}>
                        <i className="fas fa-plus"></i> Adicionar mudança na estimativa
                    </button>
                </div>
            </div>

            <div className="tempo-config-footer">
                <button className="btn-cancel" onClick={onClose}>Cancelar</button>
                <button className="btn-save" onClick={handleSaveInternal}>
                    Confirmar Estimativa
                </button>
            </div>
        </div>
    );
};

export default TempoConfigCard;
