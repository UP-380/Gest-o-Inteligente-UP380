import React, { useState, useEffect, useRef } from 'react';
import './FilterClientes.css';

const FilterClientes = ({ value, options = [], onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  // Debug: log quando options mudar
  useEffect(() => {
    console.log('📋 [FILTER-CLIENTES] Opções atualizadas:', {
      total: options.length,
      primeiros: options.slice(0, 5).map(c => ({ id: c.id, nome: c.nome }))
    });
  }, [options]);

  const selectedCliente = options.find(c => c.id === value);
  const selectedText = selectedCliente ? selectedCliente.nome : 'Selecionar clientes';

  // Filtrar opções baseado na busca
  const filteredOptions = options.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      if (onChange) {
        const fakeEvent = {
          target: { value: clienteId === value ? '' : clienteId }
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
    }
  };

  return (
    <>
      <label className="filter-label">Cliente</label>
      <div className="cliente-filter-container" ref={containerRef}>
        <div className="cliente-select-field">
          <div 
            className={`cliente-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
            onClick={handleOpen}
          >
            <span className={`cliente-select-text ${value ? 'has-selection' : ''}`}>
              {selectedText}
            </span>
            <i className={`fas fa-chevron-down cliente-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
          </div>
          {isOpen && !disabled && (
            <div className="cliente-dropdown">
              <div className="cliente-dropdown-content">
                <div className="cliente-search-container">
                  <input
                    type="text"
                    className="cliente-search-input"
                    placeholder="Buscar cliente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="cliente-options-container">
                  {filteredOptions.map((cliente) => (
                    <div
                      key={cliente.id}
                      className={`cliente-option ${value === cliente.id ? 'selected' : ''}`}
                      onClick={() => handleSelect(cliente.id)}
                    >
                      <div className="cliente-option-checkbox">
                        {value === cliente.id && <i className="fas fa-check"></i>}
                      </div>
                      <span>{cliente.nome}</span>
                    </div>
                  ))}
                  {filteredOptions.length === 0 && (
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

