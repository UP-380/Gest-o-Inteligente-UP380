import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './FilterClientes.css';

// Função para remover acentos e normalizar texto para busca
const removerAcentos = (texto) => {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const FilterClientes = ({ value, options = [], onChange, disabled = false, showInactiveToggle = false, onInactiveToggleChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);
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

  // Filtrar opções baseado na busca e status - sem considerar acentos
  const filteredOptions = options.filter(cliente => {
    // Se mostrarInativos estiver desativado, filtrar clientes inativos
    if (!mostrarInativos) {
      const status = cliente.status || 'ativo';
      if (status === 'inativo') {
        return false;
      }
    }
    
    // Filtrar por busca
    if (!searchQuery.trim()) return true;
    const queryNormalizado = removerAcentos(searchQuery.trim());
    const nomeNormalizado = removerAcentos(cliente.nome || '');
    return nomeNormalizado.includes(queryNormalizado);
  });

  // Ordenar: "SEM CLIENTE" primeiro, depois selecionados, depois os não selecionados
  const sortedOptions = useMemo(() => {
    // Separar "SEM CLIENTE" dos demais
    const semCliente = filteredOptions.find(cliente => 
      cliente.nome && cliente.nome.toUpperCase().trim() === 'SEM CLIENTE'
    );
    const outrosClientes = filteredOptions.filter(cliente => 
      !cliente.nome || cliente.nome.toUpperCase().trim() !== 'SEM CLIENTE'
    );
    
    // Separar outros clientes em selecionados e não selecionados
    const selected = outrosClientes.filter(cliente => 
      selectedIds.includes(normalizeId(cliente.id))
    );
    const notSelected = outrosClientes.filter(cliente => 
      !selectedIds.includes(normalizeId(cliente.id))
    );
    
    // Retornar: "SEM CLIENTE" primeiro (se existir), depois selecionados, depois não selecionados
    const result = [...selected, ...notSelected];
    if (semCliente) {
      return [semCliente, ...result];
    }
    return result;
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

  // Notificar o componente pai sobre mudanças no toggle de inativos
  useEffect(() => {
    if (showInactiveToggle && onInactiveToggleChange) {
      onInactiveToggleChange(mostrarInativos);
    }
  }, [showInactiveToggle, mostrarInativos, onInactiveToggleChange]);

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
                {/* Toggle para habilitar clientes inativos */}
                {showInactiveToggle && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', marginBottom: '4px', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', whiteSpace: 'nowrap' }}>
                      Habilitar clientes inativos:
                    </label>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="checkbox"
                        id="toggleClientesInativos"
                        checked={mostrarInativos}
                        onChange={(e) => {
                          const novoValor = e.target.checked;
                          setMostrarInativos(novoValor);
                        }}
                        style={{
                          width: '44px',
                          height: '24px',
                          appearance: 'none',
                          backgroundColor: mostrarInativos ? '#ef4444' : '#cbd5e1',
                          borderRadius: '12px',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          outline: 'none',
                          border: 'none'
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '2px',
                          left: mostrarInativos ? '22px' : '2px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          transition: 'left 0.2s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="cliente-options-container">
                  {sortedOptions.map((cliente) => {
                    const normalizedClienteId = normalizeId(cliente.id);
                    const isSelected = selectedIds.includes(normalizedClienteId);
                    const isInativo = (cliente.status || 'ativo') === 'inativo';
                    return (
                      <div
                        key={cliente.id}
                        className={`cliente-option ${isSelected ? 'selected' : ''} ${isInativo ? 'inactive' : ''}`}
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
                        {isInativo && <span className="cliente-option-inactive-badge">inativo</span>}
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

