import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './TempoConfigCard.css';

const parseMinutesToHHMM = (totalMinutes) => {
    const hours = Math.floor(Number(totalMinutes || 0) / 60);
    const minutes = Number(totalMinutes || 0) % 60;
    return { hours, minutes };
};

const TempoConfigCard = ({
    initialConfig = {},
    onSave,
    dataInicioPadrao = null,
    dataFimPadrao = null,
    responsavelId = null,
    disabled = false,
    label = 'Tempo',
    className = '',
    onOpenChange = null
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: -9999, left: -9999, width: 320 });
    const [positionUp, setPositionUp] = useState(false);

    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);
    const containerRef = useRef(null);

    // Garantimos que o estado é uma lista genérica de segmentos de tempo atrelados à Tarefa.
    const [segments, setSegments] = useState([]);

    // Sincronizar segmentos quando abrir ou initialConfig mudar
    useEffect(() => {
        if (isOpen) {
            const allKeys = Object.keys(initialConfig);
            if (allKeys.length > 0 && Array.isArray(initialConfig[allKeys[0]]) && initialConfig[allKeys[0]].length > 0) {
                setSegments([...initialConfig[allKeys[0]]]);
            } else {
                setSegments([
                    { tempo_minutos: 0, data_inicio: dataInicioPadrao || new Date().toISOString().split('T')[0] }
                ]);
            }
        }
    }, [isOpen, initialConfig, dataInicioPadrao]);

    const calculatePosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const dropdownWidth = 320;
            const dropdownHeight = 400; // Altura aproximada

            let top = rect.bottom + window.scrollY + 6;
            let left = rect.left + window.scrollX + (rect.width / 2) - (dropdownWidth / 2);

            // Ajuste horizontal
            if (left < 10) {
                left = 10;
            } else if (left + dropdownWidth > window.innerWidth - 10) {
                left = window.innerWidth - dropdownWidth - 10;
            }

            // Ajuste vertical (Abrir para cima se não houver espaço abaixo)
            const vh = window.innerHeight;
            const spaceBelow = vh - rect.bottom;
            const spaceAbove = rect.top;

            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                top = rect.top + window.scrollY - 10; // Posicionamento para subir
                setPositionUp(true);
            } else {
                setPositionUp(false);
            }

            setDropdownPos({ top, left, width: dropdownWidth });
        }
    };

    useEffect(() => {
        if (isOpen) {
            calculatePosition();
            window.addEventListener('scroll', calculatePosition, true);
            window.addEventListener('resize', calculatePosition);
        }
        return () => {
            window.removeEventListener('scroll', calculatePosition, true);
            window.removeEventListener('resize', calculatePosition);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggle = (e) => {
        if (disabled) return;
        const next = !isOpen;
        setIsOpen(next);
        if (onOpenChange) onOpenChange(next);
    };

    const handleClose = () => {
        setIsOpen(false);
        if (onOpenChange) onOpenChange(false);
    };

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
        if (segments.some(s => !s.data_inicio)) {
            alert('Preencha todas as datas de início.');
            return;
        }

        const dates = segments.map(s => s.data_inicio);
        if (new Set(dates).size !== dates.length) {
            alert('Você não pode ter datas de início duplicadas para a mesma tarefa.');
            return;
        }

        const payload = { 'null': segments };
        if (responsavelId != null && responsavelId !== '') {
            payload[String(responsavelId)] = segments;
        }
        onSave(payload);
        handleClose();
    };

    const triggerElement = (
        <div className={`tempo-config-trigger-container ${className}`} ref={containerRef}>
            <button
                type="button"
                ref={triggerRef}
                className={`btn-configurar-tempo-generic ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={handleToggle}
                disabled={disabled}
            >
                <i className="fas fa-cog"></i>
                <span>{label}</span>
            </button>
        </div>
    );

    const dropdownElement = (
        <div
            ref={dropdownRef}
            className={`tempo-config-popover-portal ${positionUp ? 'position-up' : ''}`}
            style={{
                position: 'absolute',
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 2000000,
                transform: positionUp ? 'translateY(-100%)' : 'none'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="tempo-config-header">
                <h4><i className="fas fa-clock"></i> Configurar Estimativa</h4>
                <button className="close-btn" onClick={handleClose}>&times;</button>
            </div>

            <div className="tempo-config-body custom-scrollbar">
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
                                            min={dataInicioPadrao || ''}
                                            max={dataFimPadrao || ''}
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
                <button className="btn-cancel" onClick={handleClose}>Cancelar</button>
                <button className="btn-save" onClick={handleSaveInternal}>
                    Confirmar Estimativa
                </button>
            </div>
        </div>
    );

    return (
        <>
            {triggerElement}
            {isOpen && !disabled && createPortal(dropdownElement, document.body)}
        </>
    );
};

export default TempoConfigCard;

