import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './FilterColaborador.css';

// Função para remover acentos e normalizar texto para busca
const removerAcentos = (texto) => {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const FilterColaborador = ({ value, options = [], onChange, disabled = false, showInactiveToggle = false, onInactiveToggleChange }) => {
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
  
  // Obter colaboradores selecionados
  const selectedColaboradores = options.filter(c => selectedIds.includes(normalizeId(c.id)));
  
  // Texto de exibição
  const getSelectedText = () => {
    if (selectedColaboradores.length === 0) {
      return 'Selecionar colaboradores';
    } else if (selectedColaboradores.length === 1) {
      const colaborador = selectedColaboradores[0];
      const nome = colaborador.nome || `Colaborador #${colaborador.id}`;
      return colaborador.cpf ? `${nome} (${colaborador.cpf})` : nome;
    } else {
      return `${selectedColaboradores.length} colaboradores selecionados`;
    }
  };

  const selectedText = getSelectedText();

  // Filtrar opções baseado na busca (nome ou CPF) e status - sem considerar acentos
  const filteredOptions = options.filter(colaborador => {
    if (!colaborador) return false;
    
    // Se mostrarInativos estiver desativado, filtrar colaboradores inativos
    if (!mostrarInativos) {
      const status = colaborador.status || 'ativo';
      if (status === 'inativo') {
        return false;
      }
    }
    
    if (!searchQuery.trim()) return true;
    
    const queryNormalizado = removerAcentos(searchQuery.trim());
    const nomeNormalizado = removerAcentos(colaborador.nome || '');
    const nomeMatch = nomeNormalizado.includes(queryNormalizado);
    
    // Buscar por CPF (remover formatação para comparação)
    const cpfMatch = colaborador.cpf && colaborador.cpf.replace(/\D/g, '').includes(queryNormalizado.replace(/\D/g, ''));
    
    return nomeMatch || cpfMatch;
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
                placeholder="Buscar colaborador por nome ou CPF..."
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
                {/* Toggle para habilitar colaboradores inativos */}
                {showInactiveToggle && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', marginBottom: '4px', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', whiteSpace: 'nowrap' }}>
                      Habilitar colaboradores inativos:
                    </label>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="checkbox"
                        id="toggleColaboradoresInativos"
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
                <div className="colaborador-options-container">
                  {sortedOptions.length > 0 ? (
                    sortedOptions.map((colaborador) => {
                      const normalizedColabId = normalizeId(colaborador.id);
                      const isSelected = selectedIds.includes(normalizedColabId);
                      const isInativo = (colaborador.status || 'ativo') === 'inativo';
                      return (
                        <div
                          key={colaborador.id}
                          className={`colaborador-option ${isSelected ? 'selected' : ''} ${isInativo ? 'inactive' : ''}`}
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
                          <span>
                            {colaborador.nome || `Colaborador #${colaborador.id}`}
                            {colaborador.cpf && ` (${colaborador.cpf})`}
                          </span>
                          {isInativo && <span className="colaborador-option-inactive-badge">inativo</span>}
                        </div>
                      );
                    })
                  ) : (
                    <div className="colaborador-option no-results">
                      <span>
                        {options.length === 0 
                          ? 'Carregando colaboradores...' 
                          : searchQuery.trim() 
                            ? 'Nenhum colaborador encontrado' 
                            : 'Nenhum colaborador disponível'}
                      </span>
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

