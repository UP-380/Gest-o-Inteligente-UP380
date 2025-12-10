import React, { useState, useEffect, useRef, useMemo } from 'react';
import './CustomSelect.css';

// Função para remover acentos e normalizar texto para busca
const removerAcentos = (texto) => {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const CustomSelect = ({ 
  value, 
  options = [], 
  onChange, 
  placeholder = 'Selecione uma opção', 
  disabled = false,
  keepOpen = false, // Se true, não fecha ao selecionar
  selectedItems = [], // Array de valores já selecionados (para multi-select)
  onSelectAll = null, // Função para selecionar todos
  hideCheckboxes = false, // Se true, esconde as checkboxes (para modo single select)
  maxVisibleOptions = null, // Número máximo de opções visíveis (null = sem limite)
  enableSearch = false // Se true, habilita busca nas opções
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    const updateDropdownPosition = () => {
      if (dropdownRef.current && containerRef.current && isOpen) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 400; // altura máxima estimada
        
        // Usar position fixed para garantir que apareça acima de tudo
        dropdownRef.current.style.position = 'fixed';
        dropdownRef.current.style.width = `${rect.width}px`;
        dropdownRef.current.style.left = `${rect.left}px`;
        dropdownRef.current.style.zIndex = '100001';
        
        // Se não há espaço suficiente abaixo, mas há acima, mostrar acima
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          dropdownRef.current.style.top = 'auto';
          dropdownRef.current.style.bottom = `${viewportHeight - rect.top}px`;
          dropdownRef.current.style.marginTop = '0';
          dropdownRef.current.style.marginBottom = '4px';
        } else {
          dropdownRef.current.style.top = `${rect.bottom + 4}px`;
          dropdownRef.current.style.bottom = 'auto';
          dropdownRef.current.style.marginTop = '0';
          dropdownRef.current.style.marginBottom = '0';
        }
        
        // Ajustar se sair da tela à direita
        if (rect.left + rect.width > viewportWidth) {
          dropdownRef.current.style.left = `${viewportWidth - rect.width - 10}px`;
        }
        
        // Ajustar se sair da tela à esquerda
        if (rect.left < 0) {
          dropdownRef.current.style.left = '10px';
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      
      // Atualizar posição inicial
      setTimeout(updateDropdownPosition, 0);
    } else {
      // Resetar estilos quando fechar
      if (dropdownRef.current) {
        dropdownRef.current.style.position = '';
        dropdownRef.current.style.width = '';
        dropdownRef.current.style.left = '';
        dropdownRef.current.style.top = '';
        dropdownRef.current.style.bottom = '';
        dropdownRef.current.style.marginTop = '';
        dropdownRef.current.style.marginBottom = '';
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue) => {
    if (!disabled && onChange) {
      const fakeEvent = {
        target: { value: optionValue }
      };
      onChange(fakeEvent);
      // Se hideCheckboxes estiver ativo (modo single select), sempre fecha após selecionar
      // Caso contrário, só fecha se keepOpen for false
      if (hideCheckboxes || !keepOpen) {
        setIsOpen(false);
      }
    }
  };

  const handleToggle = (e) => {
    if (!disabled) {
      // Se hideCheckboxes estiver ativo (modo single select), comportamento normal (fecha ao clicar novamente)
      // Se keepOpen está ativado e já está aberto, não fecha ao clicar no campo
      // Apenas fecha quando clicar fora
      if (!hideCheckboxes && keepOpen && isOpen) {
        // Deixa aberto
        return;
      }
      setIsOpen(!isOpen);
      if (!isOpen && enableSearch) {
        // Focar no input quando abrir com busca habilitada
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 0);
      } else if (!isOpen) {
        // Limpar busca ao fechar
        setSearchQuery('');
      }
    }
  };

  // Focar no input quando o dropdown abrir com busca habilitada
  useEffect(() => {
    if (isOpen && enableSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    } else if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, enableSearch]);

  const handleSelectAll = () => {
    if (onSelectAll && !disabled) {
      onSelectAll();
      // Não fecha ao selecionar todos
    }
  };

  // Filtrar opções baseado na busca - sem considerar acentos
  const filteredOptions = useMemo(() => {
    if (!enableSearch || !searchQuery.trim()) {
      return options;
    }
    const queryNormalizado = removerAcentos(searchQuery.trim());
    return options.filter(option => {
      const labelNormalizado = removerAcentos(option.label || '');
      return labelNormalizado.includes(queryNormalizado);
    });
  }, [options, searchQuery, enableSearch]);

  // Verificar se todas as opções estão selecionadas
  const allSelected = selectedItems.length > 0 && selectedItems.length === filteredOptions.length;

  return (
    <div className="custom-select-container" ref={containerRef}>
      <div 
        className={`custom-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
        onClick={!isOpen ? handleToggle : undefined}
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
          <span className={`custom-select-text ${value ? 'has-selection' : ''}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <i className={`fas fa-chevron-down custom-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
      </div>
      {isOpen && !disabled && (
        <div className="custom-select-dropdown" ref={dropdownRef}>
          <div 
            className="custom-select-dropdown-content custom-scrollbar"
            style={maxVisibleOptions ? {
              // Cada opção tem aproximadamente 42px de altura (padding 10px + texto ~22px)
              // Se tiver "Selecionar todos": adiciona ~52px (opção + divisor)
              maxHeight: `${(maxVisibleOptions * 42) + (onSelectAll && !hideCheckboxes && filteredOptions.length > 0 ? 52 : 0)}px`
            } : {}}
          >
            {/* Opção "Selecionar todos" - apenas se onSelectAll estiver definido e não estiver escondendo checkboxes */}
            {onSelectAll && !hideCheckboxes && filteredOptions.length > 0 && (
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
            {onSelectAll && !hideCheckboxes && filteredOptions.length > 0 && (
              <div className="custom-select-divider"></div>
            )}
            
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
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

