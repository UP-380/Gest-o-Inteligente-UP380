import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './FilterClienteHistorico.css';

// Função para remover acentos e normalizar texto para busca
const removerAcentos = (texto) => {
    if (!texto) return '';
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
};

const FilterClienteHistorico = ({ value, options = [], onChange, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Normalizar IDs para string para comparação consistente
    const normalizeId = useCallback((id) => String(id).trim(), []);

    // Converter value para array (suporta tanto string quanto array)
    const selectedIds = useMemo(() => {
        return Array.isArray(value)
            ? value.map(normalizeId)
            : (value ? [normalizeId(value)] : []);
    }, [value, normalizeId]);

    // Obter clientes selecionados
    const selectedClientes = options.filter(c => selectedIds.includes(normalizeId(c.id)));

    // Texto de exibição
    const getSelectedText = () => {
        if (selectedClientes.length === 0) {
            return 'Selecionar clientes';
        } else if (selectedClientes.length === 1) {
            return selectedClientes[0].nome;
        } else {
            return `${selectedClientes.length} clientes selecionados`;
        }
    };

    const selectedText = getSelectedText();

    // Filtrar opções baseado na busca - sem considerar acentos
    const filteredOptions = options.filter(cliente => {
        if (!cliente) return false;

        if (!searchQuery.trim()) return true;

        const queryNormalizado = removerAcentos(searchQuery.trim());
        const nomeNormalizado = removerAcentos(cliente.nome || '');
        return nomeNormalizado.includes(queryNormalizado);
    });

    // Ordenar: selecionados primeiro, depois os não selecionados
    const sortedOptions = useMemo(() => {
        const selected = filteredOptions.filter(cliente =>
            selectedIds.includes(normalizeId(cliente.id))
        );
        const notSelected = filteredOptions.filter(cliente =>
            !selectedIds.includes(normalizeId(cliente.id))
        );
        return [...selected, ...notSelected];
    }, [filteredOptions, selectedIds, normalizeId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (clienteId) => {
        if (!disabled) {
            // Normalizar ID para comparação
            const normalizedId = normalizeId(clienteId);

            // Toggle do cliente selecionado
            const newSelectedIds = selectedIds.includes(normalizedId)
                ? selectedIds.filter(id => id !== normalizedId)
                : [...selectedIds, normalizedId];

            if (onChange) {
                // Simular evento padrão do React
                const fakeEvent = {
                    target: { value: newSelectedIds.length > 0 ? newSelectedIds : null }
                };
                onChange(fakeEvent);
            }
            // Não fechar o dropdown automaticamente para permitir múltiplas seleções
        }
    };

    const handleOpen = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
                // Focar no input quando abrir
                setTimeout(() => {
                    if (searchInputRef.current) {
                        searchInputRef.current.focus();
                    }
                }, 0);
            } else {
                setSearchQuery('');
            }
        }
    };

    // Focar no input quando o dropdown abrir
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    return (
        <>
            <div className="cliente-historico-filter-container" ref={containerRef}>
                <div className="cliente-historico-select-field">
                    <div
                        className={`cliente-historico-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
                        onClick={!isOpen ? handleOpen : undefined}
                    >
                        {isOpen ? (
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="cliente-historico-select-input"
                                placeholder={selectedClientes.length > 0 ? selectedText : "Buscar cliente..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setIsOpen(false);
                                        setSearchQuery('');
                                    }
                                }}
                                autoComplete="off"
                            />
                        ) : (
                            <span className={`cliente-historico-select-text ${selectedIds.length > 0 ? 'has-selection' : ''}`}>
                                {selectedText}
                            </span>
                        )}
                        <i className={`fas fa-chevron-down cliente-historico-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
                    </div>
                    {isOpen && !disabled && (
                        <div className="cliente-historico-dropdown">
                            <div className="cliente-historico-dropdown-content">
                                <div className="cliente-historico-options-container">
                                    {sortedOptions.map((cliente) => {
                                        const normalizedClienteId = normalizeId(cliente.id);
                                        const isSelected = selectedIds.includes(normalizedClienteId);
                                        const isInativo = (cliente.status || 'ativo') === 'inativo';
                                        return (
                                            <div
                                                key={cliente.id}
                                                className={`cliente-historico-option ${isSelected ? 'selected' : ''} ${isInativo ? 'inactive' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleSelect(cliente.id);
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <div className="cliente-historico-option-checkbox">
                                                    {isSelected && <i className="fas fa-check"></i>}
                                                </div>
                                                <span>{cliente.nome}</span>
                                                {isInativo && <span className="cliente-historico-option-inactive-badge">inativo</span>}
                                            </div>
                                        );
                                    })}
                                    {sortedOptions.length === 0 && (
                                        <div className="cliente-historico-option no-results">
                                            <span>Nenhum cliente encontrado</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default FilterClienteHistorico;
