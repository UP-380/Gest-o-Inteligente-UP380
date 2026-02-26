import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../user/Avatar';
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
  onVigenciaChange = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

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

  // Fechar ao clicar fora (considerando que o dropdown está em portal)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Verificar se o clique foi fora do container do card E fora do dropdown
      const clickedInContainer = containerRef.current && containerRef.current.contains(event.target);
      const clickedInDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);

      if (!clickedInContainer && !clickedInDropdown) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      // Usar mousedown para capturar antes que outros eventos sejam processados
      document.addEventListener('mousedown', handleClickOutside);
      // Também usar click como fallback
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  // Travar scroll da página quando dropdown estiver aberto - scroll apenas dentro do dropdown
  useEffect(() => {
    if (isOpen) {
      // Salvar posição atual do scroll ANTES de qualquer alteração
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollX = window.scrollX || document.documentElement.scrollLeft;

      // Prevenir scroll da página - permitir apenas dentro do dropdown
      const preventScroll = (e) => {
        // Permitir scroll apenas dentro do dropdown
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
          return; // Permitir scroll dentro do dropdown
        }
        // Prevenir scroll em qualquer outro lugar
        e.preventDefault();
        e.stopPropagation();
      };

      // Prevenir scroll via teclado também
      const preventKeyScroll = (e) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
          // Permitir apenas se estiver dentro do dropdown
          if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
            return;
          }
          e.preventDefault();
        }
      };

      // Adicionar listeners para prevenir scroll
      window.addEventListener('wheel', preventScroll, { passive: false });
      window.addEventListener('touchmove', preventScroll, { passive: false });
      window.addEventListener('scroll', preventScroll, { passive: false });
      window.addEventListener('keydown', preventKeyScroll, { passive: false });

      // Travar scroll do body usando position fixed (após calcular posição)
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = `-${scrollX}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Remover listeners primeiro
        window.removeEventListener('wheel', preventScroll);
        window.removeEventListener('touchmove', preventScroll);
        window.removeEventListener('scroll', preventScroll);
        window.removeEventListener('keydown', preventKeyScroll);

        // Restaurar scroll quando fechar
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.width = '';
        document.body.style.overflow = '';

        // Restaurar posição do scroll
        window.scrollTo(scrollX, scrollY);
      };
    }
  }, [isOpen]);

  // Posicionar dropdown quando abrir
  useEffect(() => {
    if (!isOpen || !dropdownRef.current || !containerRef.current) return;

    const updatePosition = () => {
      if (!dropdownRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const bodyIsFixed = document.body.style.position === 'fixed';
      let scrollTop, scrollLeft;

      if (bodyIsFixed) {
        const bodyTop = document.body.style.top;
        const bodyLeft = document.body.style.left;
        scrollTop = bodyTop ? Math.abs(parseFloat(bodyTop)) : 0;
        scrollLeft = bodyLeft ? Math.abs(parseFloat(bodyLeft)) : 0;
      } else {
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      }

      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;

      const dropdownHeight = Math.min(dropdownRef.current.scrollHeight || 300, 400);
      const dropdownWidth = 320;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let calculatedLeft = documentLeft + rect.width + 10;
      let calculatedTop = documentTop;

      if ((calculatedLeft - scrollLeft) + dropdownWidth > viewportWidth) {
        calculatedLeft = documentLeft - dropdownWidth - 10;
      }

      if ((calculatedLeft - scrollLeft) < 10) {
        calculatedLeft = scrollLeft + 10;
      }

      const topInViewport = calculatedTop - scrollTop;
      if (topInViewport + dropdownHeight > viewportHeight) {
        const spaceAbove = topInViewport;
        const spaceBelow = viewportHeight - topInViewport;

        if (spaceAbove > spaceBelow && spaceAbove >= dropdownHeight) {
          calculatedTop = scrollTop + viewportHeight - dropdownHeight - 10;
        }
      }

      if ((calculatedTop - scrollTop) < 10) {
        calculatedTop = scrollTop + 10;
      }

      dropdownRef.current.style.position = 'absolute';
      dropdownRef.current.style.left = `${calculatedLeft}px`;
      dropdownRef.current.style.top = `${calculatedTop}px`;
      dropdownRef.current.style.width = `${dropdownWidth}px`;
      dropdownRef.current.style.maxHeight = '400px';
      dropdownRef.current.style.zIndex = '100001';
      dropdownRef.current.style.bottom = 'auto';
    };

    updatePosition();

    let rafId = requestAnimationFrame(() => {
      updatePosition();
    });

    const handleScroll = () => {
      requestAnimationFrame(updatePosition);
    };

    const handleResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    const observer = new MutationObserver(updatePosition);
    if (containerRef.current && containerRef.current.parentElement) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [isOpen, filteredOptions.length]);

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
    }
  };

  const handleToggle = () => {
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
        className={`responsavel-card ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''} ${isMulti ? 'multi' : ''}`}
        onClick={handleToggle}
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
          {!isMulti && colaboradorSelecionado ? (
            <Avatar
              avatarId={colaboradorSelecionado.foto_perfil || null}
              nomeUsuario={colaboradorSelecionado.nome}
              size="small"
              className="responsavel-card-avatar"
            />
          ) : isMulti && colaboradoresSelecionados.length > 0 ? (
            <div className="responsavel-card-multi-avatars">
              {colaboradoresSelecionados.slice(0, 2).map((c, i) => (
                <Avatar
                  key={c.id}
                  avatarId={c.foto_perfil || null}
                  nomeUsuario={c.nome}
                  size="small"
                  className="responsavel-card-avatar"
                  style={{ marginLeft: i > 0 ? '-10px' : '0' }}
                />
              ))}
              {colaboradoresSelecionados.length > 2 && (
                <div className="avatar-plus-count">+{colaboradoresSelecionados.length - 2}</div>
              )}
            </div>
          ) : (
            <i
              className="fas fa-user-group"
              style={{
                marginRight: '8px',
                color: '#6b7280',
                flexShrink: 0
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

  const dropdownElement = isOpen && !disabled ? (
    <div
      className="responsavel-card-dropdown"
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
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

            {isAPartirDeEnabled && colaboradoresSelecionados.length > 0 && (
              <div className="escalonamento-list">
                {colaboradoresSelecionados.map(c => (
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
                    <div className="escalonamento-item-date">
                      <input
                        type="date"
                        value={vigenciaDatas[c.id] || ''}
                        onChange={(e) => onVigenciaChange && onVigenciaChange(c.id, e.target.value)}
                        className="escalonamento-date-input"
                      />
                    </div>
                  </div>
                ))}
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
    </div>
  ) : null;

  return (
    <>
      {cardElement}
      {isOpen && createPortal(dropdownElement, document.body)}
    </>
  );
};

export default ResponsavelCard;
