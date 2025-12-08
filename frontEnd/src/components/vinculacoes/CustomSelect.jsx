import React, { useState, useEffect, useRef } from 'react';
import './CustomSelect.css';

const CustomSelect = ({ 
  value, 
  options = [], 
  onChange, 
  placeholder = 'Selecione uma opção', 
  disabled = false,
  keepOpen = false, // Se true, não fecha ao selecionar
  selectedItems = [], // Array de valores já selecionados (para multi-select)
  onSelectAll = null // Função para selecionar todos
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue) => {
    if (!disabled && onChange) {
      const fakeEvent = {
        target: { value: optionValue }
      };
      onChange(fakeEvent);
      // Só fecha se keepOpen for false
      if (!keepOpen) {
        setIsOpen(false);
      }
    }
  };

  const handleToggle = (e) => {
    if (!disabled) {
      // Se keepOpen está ativado e já está aberto, não fecha ao clicar no campo
      // Apenas fecha quando clicar fora
      if (keepOpen && isOpen) {
        // Deixa aberto
        return;
      }
      setIsOpen(!isOpen);
    }
  };

  const handleSelectAll = () => {
    if (onSelectAll && !disabled) {
      onSelectAll();
      // Não fecha ao selecionar todos
    }
  };

  // Verificar se todas as opções estão selecionadas
  const allSelected = selectedItems.length > 0 && selectedItems.length === options.length;

  return (
    <div className="custom-select-container" ref={containerRef}>
      <div 
        className={`custom-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
      >
        <span className={`custom-select-text ${value ? 'has-selection' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <i className={`fas fa-chevron-down custom-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
      </div>
      {isOpen && !disabled && (
        <div className="custom-select-dropdown">
          <div className="custom-select-dropdown-content custom-scrollbar">
            {/* Opção "Selecionar todos" - apenas se onSelectAll estiver definido */}
            {onSelectAll && options.length > 0 && (
              <div
                className={`custom-select-option select-all-option ${allSelected ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectAll();
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="custom-select-option-checkbox">
                  {allSelected && <i className="fas fa-check"></i>}
                </div>
                <span>
                  <strong>Selecionar todos</strong>
                  {selectedItems.length > 0 && (
                    <span className="selected-count"> ({selectedItems.length})</span>
                  )}
                </span>
              </div>
            )}
            
            {/* Divisor visual se houver "Selecionar todos" */}
            {onSelectAll && options.length > 0 && (
              <div className="custom-select-divider"></div>
            )}
            
            {options.map((option) => {
              const optionValueStr = String(option.value);
              const isSelected = selectedItems.length > 0 
                ? selectedItems.includes(optionValueStr)
                : (value === option.value || value === optionValueStr);
              return (
                <div
                  key={option.value}
                  className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(option.value);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="custom-select-option-checkbox">
                    {isSelected && <i className="fas fa-check"></i>}
                  </div>
                  <span>{option.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;

