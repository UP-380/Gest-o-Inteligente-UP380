import React, { useState, useEffect, useRef, useMemo } from 'react';
import './CustomSelect.css';

const removerAcentos = (texto) => {
  if (!texto) return '';
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

const CustomSelect = ({ 
  value, 
  options = [], 
  onChange, 
  placeholder = 'Selecione uma opção', 
  disabled = false,
  keepOpen = false,
  selectedItems = [],
  onSelectAll = null,
  hideCheckboxes = false,
  maxVisibleOptions = null,
  enableSearch = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalizar valores para string
  const normalizeValue = (val) => String(val).trim();

  // Converter selectedItems para array de strings
  const selectedItemsStr = useMemo(() => {
    return Array.isArray(selectedItems) 
      ? selectedItems.map(normalizeValue)
      : (selectedItems ? [normalizeValue(selectedItems)] : []);
  }, [selectedItems]);

  // Verificar se value está selecionado
  const isValueSelected = value !== null && value !== undefined && value !== '';

  // Texto de exibição
  const getDisplayText = () => {
    if (selectedItemsStr.length > 0) {
      const selectedOptions = options.filter(opt => 
        selectedItemsStr.includes(normalizeValue(opt.value))
      );
      if (selectedOptions.length === 1) {
        return selectedOptions[0].label;
      } else if (selectedOptions.length > 1) {
        return `${selectedOptions.length} itens selecionados`;
      }
    }
    if (isValueSelected) {
      const selectedOption = options.find(opt => 
        normalizeValue(opt.value) === normalizeValue(value)
      );
      return selectedOption ? selectedOption.label : placeholder;
    }
    return placeholder;
  };

  const displayText = getDisplayText();

  // Filtrar opções baseado na busca
  const filteredOptions = useMemo(() => {
    if (!enableSearch || !searchQuery.trim()) return options;
    const query = removerAcentos(searchQuery.trim());
    return options.filter(opt => 
      removerAcentos(opt.label || '').includes(query)
    );
  }, [options, searchQuery, enableSearch]);

  // Ordenar: selecionados primeiro
  const sortedOptions = useMemo(() => {
    const selected = filteredOptions.filter(opt => {
      const optValueStr = normalizeValue(opt.value);
      return selectedItemsStr.includes(optValueStr) || 
             (isValueSelected && normalizeValue(value) === optValueStr);
    });
    const notSelected = filteredOptions.filter(opt => {
      const optValueStr = normalizeValue(opt.value);
      return !selectedItemsStr.includes(optValueStr) && 
             !(isValueSelected && normalizeValue(value) === optValueStr);
    });
    return [...selected, ...notSelected];
  }, [filteredOptions, selectedItemsStr, value, isValueSelected]);

  // Fechar ao clicar fora - igual ao FilterClientes
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

  // Posicionar dropdown quando abrir
  useEffect(() => {
    if (!isOpen || !dropdownRef.current || !containerRef.current) return;

    const updatePosition = () => {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      dropdownRef.current.style.position = 'fixed';
      dropdownRef.current.style.width = `${rect.width}px`;
      dropdownRef.current.style.left = `${rect.left}px`;
      dropdownRef.current.style.zIndex = '100001';
      
      if (spaceBelow < 400 && spaceAbove > spaceBelow) {
        dropdownRef.current.style.top = 'auto';
        dropdownRef.current.style.bottom = `${viewportHeight - rect.top}px`;
      } else {
        dropdownRef.current.style.top = `${rect.bottom + 4}px`;
        dropdownRef.current.style.bottom = 'auto';
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Focar input de busca
  useEffect(() => {
    if (isOpen && enableSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, enableSearch]);

  const handleSelect = (optionValue) => {
    if (disabled || !onChange) return;
    
    onChange({ target: { value: optionValue } });
    
    // Fechar apenas se não for keepOpen ou se for hideCheckboxes
    if (!keepOpen || hideCheckboxes) {
      setIsOpen(false);
    }
  };

  const handleSelectAll = () => {
    if (onSelectAll && !disabled) {
      onSelectAll();
    }
  };

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
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

  const allSelected = selectedItemsStr.length > 0 && 
    selectedItemsStr.length === filteredOptions.length;

  return (
    <div className="custom-select-container" ref={containerRef}>
      <div 
        className={`custom-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
        onClick={!isOpen ? handleOpen : undefined}
      >
        {isOpen && enableSearch ? (
          <input
            ref={searchInputRef}
            type="text"
            className="custom-select-input"
            placeholder={placeholder}
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
          <span className={`custom-select-text ${(isValueSelected || selectedItemsStr.length > 0) ? 'has-selection' : ''}`}>
            {displayText}
          </span>
        )}
        <i className={`fas fa-chevron-down custom-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
      </div>
      
      {isOpen && !disabled && (
        <div className="custom-select-dropdown" ref={dropdownRef}>
          <div 
            className="custom-select-dropdown-content custom-scrollbar"
            style={maxVisibleOptions ? {
              maxHeight: `${(maxVisibleOptions * 42) + (onSelectAll && !hideCheckboxes && filteredOptions.length > 0 ? 52 : 0)}px`
            } : {}}
          >
            {onSelectAll && !hideCheckboxes && filteredOptions.length > 0 && (
              <>
                <div
                  className={`custom-select-option select-all-option ${allSelected ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleSelectAll();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="custom-select-option-checkbox">
                    {allSelected && <i className="fas fa-check"></i>}
                  </div>
                  <span>
                    <strong>Selecionar todos</strong>
                    {selectedItemsStr.length > 0 && (
                      <span className="selected-count"> ({selectedItemsStr.length})</span>
                    )}
                  </span>
                </div>
                <div className="custom-select-divider"></div>
              </>
            )}
            
            {sortedOptions.length > 0 ? (
              sortedOptions.map((option) => {
                const optionValueStr = normalizeValue(option.value);
                const isSelected = selectedItemsStr.length > 0 
                  ? selectedItemsStr.includes(optionValueStr)
                  : (isValueSelected && normalizeValue(value) === optionValueStr);
                
                return (
                  <div
                    key={option.value}
                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSelect(option.value);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {!hideCheckboxes && (
                      <div className="custom-select-option-checkbox">
                        {isSelected && <i className="fas fa-check"></i>}
                      </div>
                    )}
                    <span>{option.label}</span>
                  </div>
                );
              })
            ) : (
              <div className="custom-select-option no-results">
                <span>Nenhuma opção encontrada</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
