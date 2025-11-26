import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './FilterClientes.css';

const FilterClientes = ({ value, options = [], onChange, disabled = false }) => {
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

  // Filtrar opções baseado na busca
  const filteredOptions = options.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        const fakeEvent = {
          target: { value: newSelectedIds.length > 0 ? newSelectedIds : null }
        };
        onChange(fakeEvent);
      }
      // Não fechar o dropdown automaticamente para permitir múltiplas seleções
      // setIsOpen(false);
      // setSearchQuery('');
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
      <label className="filter-label">Cliente</label>
      <div className="cliente-filter-container" ref={containerRef}>
        <div className="cliente-select-field">
          <div 
            className={`cliente-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
            onClick={!isOpen ? handleOpen : undefined}
          >
            {isOpen ? (
              <input
                ref={searchInputRef}
                type="text"
                className="cliente-select-input"
                placeholder="Buscar cliente..."
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
              <span className={`cliente-select-text ${selectedIds.length > 0 ? 'has-selection' : ''}`}>
                {selectedText}
              </span>
            )}
            <i className={`fas fa-chevron-down cliente-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
          </div>
          {isOpen && !disabled && (
            <div className="cliente-dropdown">
              <div className="cliente-dropdown-content">
                <div className="cliente-options-container">
                  {sortedOptions.map((cliente) => {
                    const normalizedClienteId = normalizeId(cliente.id);
                    const isSelected = selectedIds.includes(normalizedClienteId);
                    return (
                      <div
                        key={cliente.id}
                        className={`cliente-option ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleSelect(cliente.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="cliente-option-checkbox">
                          {isSelected && <i className="fas fa-check"></i>}
                        </div>
                        <span>{cliente.nome}</span>
                      </div>
                    );
                  })}
                  {sortedOptions.length === 0 && (
                    <div className="cliente-option no-results">
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

export default FilterClientes;

