import React, { useState, useEffect, useRef, useMemo } from 'react';
import './FilterStatus.css';

const FilterStatus = ({ value, options = [], onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedText = value ? (options.find(s => s === value) || 'Selecionar status') : 'Selecionar status';

  // Filtrar opções baseado na busca
  const filteredOptions = options.filter(status =>
    status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ordenar: selecionados primeiro, depois os não selecionados
  const sortedOptions = useMemo(() => {
    const selected = filteredOptions.filter(status => value === status);
    const notSelected = filteredOptions.filter(status => value !== status);
    return [...selected, ...notSelected];
  }, [filteredOptions, value]);

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

  // Focar no input quando o dropdown abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (status) => {
    if (!disabled) {
      if (onChange) {
        // Simular evento para compatibilidade
        const fakeEvent = {
          target: { value: status === value ? '' : status }
        };
        onChange(fakeEvent);
      }
      setIsOpen(false);
      setSearchQuery('');
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

  return (
    <>
      <label className="filter-label">Status</label>
      <div className="status-filter-container" ref={containerRef}>
        <div className="status-select-field">
          <div 
            className={`status-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
            onClick={!isOpen ? handleOpen : undefined}
          >
            {isOpen ? (
              <input
                ref={searchInputRef}
                type="text"
                className="status-select-input"
                placeholder="Buscar status..."
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
              <span className={`status-select-text ${value ? 'has-selection' : ''}`}>
                {selectedText}
              </span>
            )}
            <i className={`fas fa-chevron-down status-select-arrow ${isOpen ? 'open' : ''}`}></i>
          </div>
          {isOpen && !disabled && (
            <div className="status-dropdown">
              <div className="status-dropdown-content">
                {sortedOptions.map((status) => (
                  <div
                    key={status}
                    className={`status-option ${value === status ? 'selected' : ''}`}
                    onClick={() => handleSelect(status)}
                  >
                    <div className="status-option-checkbox">
                      {value === status && <i className="fas fa-check"></i>}
                    </div>
                    <span>{status}</span>
                  </div>
                ))}
                {sortedOptions.length === 0 && (
                  <div className="status-option no-results">
                    <span>Nenhum status encontrado</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FilterStatus;

