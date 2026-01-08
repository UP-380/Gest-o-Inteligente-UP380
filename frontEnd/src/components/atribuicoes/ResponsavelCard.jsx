import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ResponsavelCard.css';

const ResponsavelCard = ({ 
  value, 
  options = [], 
  onChange, 
  placeholder = 'Selecione responsável',
  disabled = false,
  colaboradores = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const cardRef = useRef(null); // Ref para o card real (como o triggerElement do DetailSideCard)
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalizar valores para string
  const normalizeValue = (val) => String(val).trim();

  // Função para remover acentos
  const removerAcentos = (texto) => {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  // Obter colaborador selecionado
  const colaboradorSelecionado = colaboradores.find(c => 
    normalizeValue(c.id) === normalizeValue(value)
  );

  // Filtrar opções baseado na busca
  const filteredOptions = options.filter(opt => {
    if (!searchQuery.trim()) return true;
    const query = removerAcentos(searchQuery.trim());
    const label = removerAcentos(opt.label || '');
    return label.includes(query);
  });

  // Fechar ao clicar fora
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

  // Posicionar dropdown fixo ao lado do card durante o scroll
  useEffect(() => {
    if (!isOpen || !dropdownRef.current || !cardRef.current) return;

    // Função para calcular e aplicar posição fixa ao lado do card
    const applyPosition = () => {
      if (!dropdownRef.current || !cardRef.current) return;
      
      const cardRect = cardRef.current.getBoundingClientRect();
      
      // Verificar se o card está visível
      if (cardRect.width === 0 || cardRect.height === 0) return;
      
      const dropdownWidth = 300;
      const dropdownHeight = Math.min(dropdownRef.current.scrollHeight || 300, 400);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // Posicionar à direita do card, alinhado com o topo
      let left = cardRect.right + 10;
      let top = cardRect.top;
      
      // Se não cabe à direita, posicionar à esquerda
      if (left + dropdownWidth > vw - 10) {
        left = cardRect.left - dropdownWidth - 10;
      }
      
      // Garantir que não saia da tela à esquerda
      if (left < 10) {
        left = 10;
      }
      
      // Garantir que não saia da tela à direita
      if (left + dropdownWidth > vw - 10) {
        left = vw - dropdownWidth - 10;
      }
      
      // Ajustar verticalmente se necessário - manter alinhado com o topo do card
      if (top + dropdownHeight > vh - 10) {
        // Se não cabe abaixo, ajustar para cima
        top = Math.max(10, cardRect.bottom - dropdownHeight);
      }
      if (top < 10) {
        top = 10;
      }
      
      // Usar position: fixed para ficar fixo durante o scroll
      dropdownRef.current.style.position = 'fixed';
      dropdownRef.current.style.left = `${left}px`;
      dropdownRef.current.style.top = `${top}px`;
      dropdownRef.current.style.width = `${dropdownWidth}px`;
      dropdownRef.current.style.maxHeight = '400px';
      dropdownRef.current.style.zIndex = '100001';
    };
    
    // Aplicar posição após um pequeno delay para garantir que o card está renderizado
    const timeoutId = setTimeout(() => {
      applyPosition();
    }, 0);
    
    // Atualizar após renderização
    const rafId = requestAnimationFrame(() => {
      applyPosition();
    });
    
    // Atualizar continuamente durante o scroll para acompanhar o card
    let scrollRafId = null;
    const handleScroll = () => {
      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(() => {
        applyPosition();
        scrollRafId = null;
      });
    };
    
    const handleResize = () => {
      applyPosition();
    };
    
    // Escutar todos os eventos de scroll
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
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
    
    if (onChange) {
      onChange({ target: { value: optionValue } });
    }
    
    setIsOpen(false);
    setSearchQuery('');
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

  const displayText = colaboradorSelecionado 
    ? (colaboradorSelecionado.cpf 
        ? `${colaboradorSelecionado.nome} (${colaboradorSelecionado.cpf})` 
        : colaboradorSelecionado.nome)
    : placeholder;

  const cardElement = (
    <div className="responsavel-card-container" ref={containerRef}>
      <div 
        ref={cardRef}
        className={`responsavel-card ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="responsavel-card-content">
          <i className="fas fa-user-tie" style={{ marginRight: '8px', color: '#6b7280' }}></i>
          <span className={`responsavel-card-text ${colaboradorSelecionado ? 'has-selection' : ''}`}>
            {displayText}
          </span>
        </div>
        <i className={`fas fa-chevron-down responsavel-card-arrow ${isOpen ? 'rotated' : ''}`}></i>
      </div>
    </div>
  );

  const dropdownElement = isOpen && !disabled ? (
    <div className="responsavel-card-dropdown" ref={dropdownRef}>
      <div className="responsavel-card-dropdown-content custom-scrollbar">
        {/* Campo de busca */}
        <div className="responsavel-card-search">
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
        
        {/* Lista de opções */}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const isSelected = normalizeValue(option.value) === normalizeValue(value);
            
            return (
              <div
                key={option.value}
                className={`responsavel-card-option ${isSelected ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleSelect(option.value);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="responsavel-card-option-checkbox">
                  {isSelected && <i className="fas fa-check"></i>}
                </div>
                <span>{option.label}</span>
              </div>
            );
          })
        ) : (
          <div className="responsavel-card-option no-results">
            <span>Nenhum colaborador encontrado</span>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {cardElement}
      {dropdownElement && createPortal(dropdownElement, document.body)}
    </>
  );
};

export default ResponsavelCard;

