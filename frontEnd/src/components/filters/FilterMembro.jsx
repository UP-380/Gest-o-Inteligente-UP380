import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './FilterColaborador.css'; // Reutilizar CSS do FilterColaborador

// Função para remover acentos e normalizar texto para busca
const removerAcentos = (texto) => {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const FilterMembro = ({ value, options = [], onChange, disabled = false }) => {
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
  
  // Obter membros selecionados
  const selectedMembros = options.filter(m => selectedIds.includes(normalizeId(m.id)));
  
  // Texto de exibição
  const getSelectedText = () => {
    if (selectedMembros.length === 0) {
      return 'Selecionar responsáveis';
    } else if (selectedMembros.length === 1) {
      return selectedMembros[0].nome;
    } else {
      return `${selectedMembros.length} responsáveis selecionados`;
    }
  };

  const selectedText = getSelectedText();

  // Filtrar opções baseado na busca (nome) - sem considerar acentos
  const filteredOptions = options.filter(membro => {
    if (!membro) return false;
    
    if (!searchQuery.trim()) return true;
    
    const queryNormalizado = removerAcentos(searchQuery.trim());
    const nomeNormalizado = removerAcentos(membro.nome || '');
    return nomeNormalizado.includes(queryNormalizado);
  });

  // Ordenar: selecionados primeiro, depois os não selecionados
  const sortedOptions = useMemo(() => {
    const selected = filteredOptions.filter(membro => 
      selectedIds.includes(normalizeId(membro.id))
    );
    const notSelected = filteredOptions.filter(membro => 
      !selectedIds.includes(normalizeId(membro.id))
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

  const handleSelect = (membroId) => {
    if (!disabled) {
      // Normalizar ID para comparação
      const normalizedId = normalizeId(membroId);
      
      // Toggle do membro selecionado
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
                placeholder="Buscar responsável..."
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
                  {sortedOptions.map((membro) => {
                    const normalizedMembroId = normalizeId(membro.id);
                    const isSelected = selectedIds.includes(normalizedMembroId);
                    return (
                      <div
                        key={membro.id}
                        className={`colaborador-option ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleSelect(membro.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="colaborador-option-checkbox">
                          {isSelected && <i className="fas fa-check"></i>}
                        </div>
                        <span>{membro.nome}</span>
                      </div>
                    );
                  })}
                  {sortedOptions.length === 0 && (
                    <div className="colaborador-option no-results">
                      <span>Nenhum responsável encontrado</span>
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

export default FilterMembro;

