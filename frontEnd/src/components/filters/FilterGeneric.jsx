import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './FilterClientes.css'; // Reutilizar CSS do FilterClientes

// Função para remover acentos e normalizar texto para busca
const removerAcentos = (texto) => {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const FilterGeneric = ({ value, options = [], onChange, disabled = false, placeholder = 'Selecionar' }) => {
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
  
  // Obter itens selecionados
  const selectedItems = options.filter(item => selectedIds.includes(normalizeId(item.id)));
  
  // Texto de exibição
  const getSelectedText = () => {
    if (selectedItems.length === 0) {
      return placeholder;
    } else if (selectedItems.length === 1) {
      return selectedItems[0].nome;
    } else {
      return `${selectedItems.length} selecionados`;
    }
  };

  const selectedText = getSelectedText();

  // Filtrar opções baseado na busca - sem considerar acentos
  const filteredOptions = options.filter(item => {
    if (!searchQuery.trim()) return true;
    const queryNormalizado = removerAcentos(searchQuery.trim());
    const nomeNormalizado = removerAcentos(item.nome || '');
    return nomeNormalizado.includes(queryNormalizado);
  });

  // Ordenar: selecionados primeiro, depois os não selecionados
  const sortedOptions = useMemo(() => {
    const selected = filteredOptions.filter(item => 
      selectedIds.includes(normalizeId(item.id))
    );
    const notSelected = filteredOptions.filter(item => 
      !selectedIds.includes(normalizeId(item.id))
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

  const handleSelect = (itemId) => {
    if (!disabled) {
      const normalizedId = normalizeId(itemId);
      
      // Toggle do item selecionado
      const newSelectedIds = selectedIds.includes(normalizedId)
        ? selectedIds.filter(id => id !== normalizedId)
        : [...selectedIds, normalizedId];
      
      if (onChange) {
        // Usar evento fake (padrão do FilterClientes e FilterColaborador)
        const fakeEvent = {
          target: { value: newSelectedIds.length > 0 ? newSelectedIds : null }
        };
        onChange(fakeEvent);
      }
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
                placeholder={`Buscar ${placeholder.toLowerCase()}...`}
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
              <span className={`cliente-select-text ${selectedItems.length > 0 ? 'has-selection' : ''}`}>
                {selectedText}
              </span>
            )}
            <i className={`fas fa-chevron-down cliente-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
          </div>
          {isOpen && !disabled && (
            <div className="cliente-dropdown">
              <div className="cliente-dropdown-content">
                <div className="cliente-options-container">
                  {sortedOptions.map((item) => {
                    const normalizedItemId = normalizeId(item.id);
                    const isSelected = selectedIds.includes(normalizedItemId);
                    return (
                      <div
                        key={item.id}
                        className={`cliente-option ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleSelect(item.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="cliente-option-checkbox">
                          {isSelected && <i className="fas fa-check"></i>}
                        </div>
                        <span>{item.nome}</span>
                      </div>
                    );
                  })}
                  {sortedOptions.length === 0 && (
                    <div className="cliente-option no-results">
                      <span>Nenhum item encontrado</span>
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

export default FilterGeneric;

