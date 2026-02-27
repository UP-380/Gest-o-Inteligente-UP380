import React, { useState, useEffect, useRef } from 'react';
import Avatar from '../user/Avatar';
import { createPortal } from 'react-dom';
import './ResponsavelCard.css';

const ResponsavelCard = ({
  value,
  options = [],
  onChange,
  placeholder = 'Selecione responsável',
  disabled = false,
  colaboradores = [],
  isMulti = false,
  selectedValues = [],
  showAPartirDe = false,
  isAPartirDeEnabled = false,
  onAPartirDeToggle = null,
  vigenciaDatas = {},
  onVigenciaChange = null,
  onOpenChange = null,
  // Novos props para Cálculo de Tempo Disponível
  periodo = null,
  horasContratadasPorResponsavel = {},
  tempoEstimadoDia = {},
  tarefasSelecionadasPorProduto = null,
  calcularTempoDisponivel = null,
  formatarTempoEstimado = null,
  produtoId = null,
  tarefaId = null
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const triggerRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: -9999, left: -9999, width: 320 });

  // Normalizar valores para string
  const normalizeValue = (val) => String(val).trim();

  // Função para remover acentos
  const removerAcentos = (texto) => {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  // Obter colaboradores selecionados
  const colaboradoresSelecionados = isMulti
    ? colaboradores.filter(c => selectedValues.map(normalizeValue).includes(normalizeValue(c.id)))
    : colaboradores.filter(c => normalizeValue(c.id) === normalizeValue(value));

  const colaboradorSelecionado = !isMulti ? colaboradoresSelecionados[0] : null;

  // Filtrar opções baseado na busca
  const filteredOptions = options.filter(opt => {
    if (!searchQuery.trim()) return true;
    const query = removerAcentos(searchQuery.trim());
    const label = removerAcentos(opt.label || '');
    return label.includes(query);
  });

  // Cálculo de Posição do Dropdown
  const calculatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = 320;
      const dropdownHeight = 400; // Altura máxima aproximada

      let top = rect.bottom + window.scrollY + 6;
      // Centralizar horizontalmente em relação ao gatilho
      let left = rect.left + window.scrollX + (rect.width / 2) - (dropdownWidth / 2);

      // Ajuste horizontal para manter dentro da tela
      if (left < 10) {
        left = 10;
      } else if (left + dropdownWidth > window.innerWidth - 10) {
        left = window.innerWidth - dropdownWidth - 10;
      }

      // Ajuste vertical se estourar o fundo da tela
      if (rect.bottom + dropdownHeight > window.innerHeight && rect.top > dropdownHeight) {
        top = rect.top + window.scrollY - dropdownHeight - 6;
      }

      setDropdownPos({ top, left, width: dropdownWidth });
    }
  };

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
    }
    return () => {
      window.removeEventListener('scroll', calculatePosition, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isOpen]);

  // Fechar ao clicar fora (considerando que o dropdown está em portal)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Verificar se o clique foi fora do container do card E fora do dropdown
      const clickedInContainer = containerRef.current && containerRef.current.contains(event.target);
      const clickedInDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);

      if (!clickedInContainer && !clickedInDropdown) {
        setIsOpen(false);
        setSearchQuery('');
        if (onOpenChangeRef.current) onOpenChangeRef.current(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);



  // Focar input de busca
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    if (disabled) return;

    if (isMulti) {
      const val = normalizeValue(optionValue);
      const alreadySelected = selectedValues.map(normalizeValue).includes(val);
      let newValues;
      if (alreadySelected) {
        newValues = selectedValues.filter(v => normalizeValue(v) !== val);
      } else {
        newValues = [...selectedValues, optionValue];
      }
      if (onChange) {
        onChange({ target: { value: newValues, isMulti: true } });
      }
      // No multi-select não fechamos o dropdown automaticamente
    } else {
      if (onChange) {
        onChange({ target: { value: optionValue } });
      }
      setIsOpen(false);
      setSearchQuery('');
      if (onOpenChangeRef.current) onOpenChangeRef.current(false);
    }
  };

  const handleToggle = () => {
    if (!disabled) {
      const nextOpen = !isOpen;
      setIsOpen(nextOpen);
      if (onOpenChangeRef.current) onOpenChangeRef.current(nextOpen);

      if (nextOpen) {
        calculatePosition();
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

  const getDisplayText = () => {
    if (isMulti) {
      if (colaboradoresSelecionados.length === 0) return placeholder;
      if (colaboradoresSelecionados.length === 1) return colaboradoresSelecionados[0].nome;
      return `${colaboradoresSelecionados.length} responsáveis`;
    }
    return colaboradorSelecionado
      ? (colaboradorSelecionado.cpf
        ? `${colaboradorSelecionado.nome} (${colaboradorSelecionado.cpf})`
        : colaboradorSelecionado.nome)
      : placeholder;
  };

  const cardElement = (
    <div className="responsavel-card-container" ref={containerRef}>
      <div
        ref={triggerRef}
        className={`responsavel-card ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''} ${isMulti ? 'multi' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggle();
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            handleToggle();
          }
        }}
        title={isMulti && colaboradoresSelecionados.length > 0 ? colaboradoresSelecionados.map(c => c.nome).join(', ') : ''}
      >
        <div className="responsavel-card-content">
          {colaboradoresSelecionados.length === 1 ? (
            <Avatar
              avatarId={colaboradoresSelecionados[0].foto_perfil || null}
              nomeUsuario={colaboradoresSelecionados[0].nome}
              size="small"
              className="responsavel-card-avatar"
            />
          ) : (
            <i
              className="fas fa-user-group"
              style={{
                marginRight: '4px',
                color: 'inherit', // Permite que o estilo pai controle a cor (como branco na tag)
                flexShrink: 0,
                fontSize: '11px'
              }}
            ></i>
          )}
          <span className={`responsavel-card-text ${(colaboradorSelecionado || (isMulti && colaboradoresSelecionados.length > 0)) ? 'has-selection' : ''}`}>
            {getDisplayText()}
          </span>
        </div>
        <i className={`fas fa-chevron-down responsavel-card-arrow ${isOpen ? 'rotated' : ''}`}></i>
      </div>
    </div>
  );

  const dropdownElement = (
    <div className="responsavel-card-dropdown-content custom-scrollbar">
      {showAPartirDe && (
        <div className="responsavel-card-escalonamento">
          <div className="escalonamento-header">
            <div className="escalonamento-toggle-wrapper">
              <span className="escalonamento-label">Escalonar (A partir de)</span>
              <label className="vigencia-toggle-switch">
                <input
                  type="checkbox"
                  checked={isAPartirDeEnabled}
                  onChange={(e) => onAPartirDeToggle && onAPartirDeToggle(e.target.checked)}
                />
                <span className="vigencia-toggle-slider"></span>
              </label>
            </div>
          </div>

          {colaboradoresSelecionados.length > 0 && (
            <div className="escalonamento-list">
              {colaboradoresSelecionados.map(c => {
                // Cálculo de tempo disponível
                let tempoElement = null;
                if (calcularTempoDisponivel && formatarTempoEstimado && periodo && (periodo.inicio && periodo.fim || (Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0))) {
                  const tarefasParaCalculo = tarefasSelecionadasPorProduto || { [produtoId]: { [tarefaId]: { selecionada: true } } };
                  const tempoDisponivel = calcularTempoDisponivel(c.id, periodo, horasContratadasPorResponsavel, tempoEstimadoDia, tarefasParaCalculo, null);

                  if (tempoDisponivel !== undefined && tempoDisponivel !== null) {
                    const isExcedido = tempoDisponivel < 0;
                    const dias = (periodo.inicio && periodo.fim)
                      ? "no período"
                      : `${Array.isArray(periodo.datasIndividuais) ? periodo.datasIndividuais.length : 0} dias selecionados`;

                    tempoElement = (
                      <div
                        className="escalonamento-item-time"
                        style={{
                          padding: '3px 8px',
                          backgroundColor: isExcedido ? '#fef2f2' : '#f0f9ff',
                          border: `1px solid ${isExcedido ? '#ef4444' : '#0ea5e9'}`,
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: isExcedido ? '#991b1b' : '#0c4a6e',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                          cursor: 'help',
                          marginLeft: 'auto',
                          marginRight: isAPartirDeEnabled ? '8px' : '0'
                        }}
                        title={`${isExcedido ? "Tempo excedido" : "Tempo disponível"} para ${c.nome} ${dias}`}
                      >
                        <i className="fas fa-clock" style={{ fontSize: '10px' }}></i>
                        <span>{isExcedido ? `-${formatarTempoEstimado(Math.abs(tempoDisponivel), false)}` : formatarTempoEstimado(tempoDisponivel, false)}</span>
                      </div>
                    );
                  }
                }

                return (
                  <div key={`vigencia-${c.id}`} className="escalonamento-item">
                    <div className="escalonamento-item-info">
                      <Avatar
                        avatarId={c.foto_perfil || null}
                        nomeUsuario={c.nome}
                        size="small"
                        className="responsavel-card-option-avatar"
                      />
                      <span className="escalonamento-item-name">{c.nome}</span>
                    </div>

                    {tempoElement}

                    {isAPartirDeEnabled && (
                      <div className="escalonamento-item-date">
                        <input
                          type="date"
                          value={vigenciaDatas[c.id] || ''}
                          onChange={(e) => onVigenciaChange && onVigenciaChange(c.id, e.target.value)}
                          className="escalonamento-date-input"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="responsavel-card-search">
        <div className="responsavel-card-search-wrapper">
          <i className="fas fa-search" style={{ color: '#9ca3af', fontSize: '14px' }}></i>
          <input
            ref={searchInputRef}
            type="text"
            className="responsavel-card-search-input"
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
        </div>
      </div>

      {filteredOptions.length > 0 ? (
        filteredOptions.map((option) => {
          const val = normalizeValue(option.value);
          const isSelected = isMulti
            ? selectedValues.map(normalizeValue).includes(val)
            : normalizeValue(value) === val;

          const colaboradorOption = colaboradores.find(c =>
            normalizeValue(c.id) === val
          );

          return (
            <div
              key={val}
              className={`responsavel-card-option ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {colaboradorOption ? (
                <Avatar
                  avatarId={colaboradorOption.foto_perfil || null}
                  nomeUsuario={colaboradorOption.nome}
                  size="small"
                  className="responsavel-card-option-avatar"
                />
              ) : (
                <div className="responsavel-card-option-avatar">
                  <i className="fas fa-user"></i>
                </div>
              )}
              <span className="responsavel-card-option-label">{option.label}</span>
              {isSelected && isMulti && (
                <i className="fas fa-check" style={{ marginLeft: 'auto', fontSize: '12px', color: '#0e3b6f' }}></i>
              )}
            </div>
          );
        })
      ) : (
        <div className="responsavel-card-option no-results">
          Nenhum colaborador encontrado
        </div>
      )}
    </div>
  );

  return (
    <>
      {cardElement}
      {isOpen && !disabled && createPortal(
        <div
          ref={dropdownRef}
          className="responsavel-card-dropdown"
          style={{
            position: 'absolute',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 10000000
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {dropdownElement}
        </div>,
        document.body
      )}
    </>
  );
};

export default ResponsavelCard;
