import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './FilterColaborador.css';

const FilterColaborador = ({ value, options = [], onChange, disabled = false }) => {
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
  
  // Obter colaboradores selecionados
  const selectedColaboradores = options.filter(c => selectedIds.includes(normalizeId(c.id)));
  
  // Texto de exibição
  const getSelectedText = () => {
    if (selectedColaboradores.length === 0) {
      return 'Selecionar colaboradores';
    } else if (selectedColaboradores.length === 1) {
      const nome = selectedColaboradores[0].nome;
      return nome || `Colaborador #${selectedColaboradores[0].id}`;
    } else {
      return `${selectedColaboradores.length} colaboradores selecionados`;
    }
  };

  const selectedText = getSelectedText();

  // Filtrar opções baseado na busca
  const filteredOptions = options.filter(colaborador => {
    if (!colaborador || !colaborador.nome) return true; // Incluir colaboradores sem nome
    return colaborador.nome.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Ordenar: selecionados primeiro, depois os não selecionados
  const sortedOptions = useMemo(() => {
    const selected = filteredOptions.filter(colaborador => 
      selectedIds.includes(normalizeId(colaborador.id))
    );
    const notSelected = filteredOptions.filter(colaborador => 
      !selectedIds.includes(normalizeId(colaborador.id))
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

  // Debug: log quando value mudar
  useEffect(() => {
  }, [value, selectedIds, selectedColaboradores]);

  const handleSelect = (colaboradorId) => {
    if (!disabled) {
      // Normalizar ID para comparação
      const normalizedId = normalizeId(colaboradorId);
      
      // Toggle do colaborador selecionado
      const newSelectedIds = selectedIds.includes(normalizedId)
        ? selectedIds.filter(id => id !== normalizedId)
        : [...selectedIds, normalizedId];
      
      console.log('🔍 FilterColaborador - Seleção:', {
        colaboradorId,
        normalizedId,
        selectedIdsAntes: selectedIds,
        newSelectedIds,
        totalSelecionados: newSelectedIds.length
      });
      
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
      <label className="filter-label">Colaboradores</label>
      <div className="colaborador-filter-container" ref={containerRef}>
        <div className="colaborador-select-field">
          <div 
            className={`colaborador-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
            onClick={!isOpen ? handleOpen : undefined}
          >
            {isOpen ? (
              <input
                ref={searchInputRef}
                type="text"
                className="colaborador-select-input"
                placeholder="Buscar colaborador..."
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
              <span className={`colaborador-select-text ${selectedIds.length > 0 ? 'has-selection' : ''}`}>
                {selectedText}
              </span>
            )}
            <i className={`fas fa-chevron-down colaborador-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
          </div>
          {isOpen && !disabled && (
            <div className="colaborador-dropdown">
              <div className="colaborador-dropdown-content">
                <div className="colaborador-options-container">
                  {sortedOptions.map((colaborador) => {
                    const normalizedColabId = normalizeId(colaborador.id);
                    const isSelected = selectedIds.includes(normalizedColabId);
                    return (
                      <div
                        key={colaborador.id}
                        className={`colaborador-option ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleSelect(colaborador.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="colaborador-option-checkbox">
                          {isSelected && <i className="fas fa-check"></i>}
                        </div>
                        <span>{colaborador.nome || `Colaborador #${colaborador.id}`}</span>
                      </div>
                    );
                  })}
                  {sortedOptions.length === 0 && (
                    <div className="colaborador-option no-results">
                      <span>Nenhum colaborador encontrado</span>
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

export default FilterColaborador;

