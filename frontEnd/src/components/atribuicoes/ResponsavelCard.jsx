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
  colaboradores = []
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

  // Posicionar dropdown quando abrir - EXATAMENTE como DetailSideCard (position: absolute com coordenadas do documento)
  useEffect(() => {
    if (!isOpen || !dropdownRef.current || !containerRef.current) return;

    const updatePosition = () => {
      if (!dropdownRef.current || !containerRef.current) return;
      
      // EXATAMENTE a mesma lógica do DetailSideCard - sempre ao lado e alinhado ao topo
      const rect = containerRef.current.getBoundingClientRect();
      
      // Quando o body está com position: fixed, o scrollTop/scrollLeft podem estar zerados
      // Mas o getBoundingClientRect() já retorna coordenadas relativas à viewport atual
      // Precisamos obter o scroll original antes do body ser fixado
      const bodyIsFixed = document.body.style.position === 'fixed';
      let scrollTop, scrollLeft;
      
      if (bodyIsFixed) {
        // Se o body está fixed, o scroll foi "simulado" via top/left do body
        const bodyTop = document.body.style.top;
        const bodyLeft = document.body.style.left;
        scrollTop = bodyTop ? Math.abs(parseFloat(bodyTop)) : 0;
        scrollLeft = bodyLeft ? Math.abs(parseFloat(bodyLeft)) : 0;
      } else {
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      }
      
      // Posição no documento (considerando scroll) - IGUAL ao DetailSideCard
      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;
      
      // Calcular altura real do dropdown após renderização
      const dropdownHeight = Math.min(dropdownRef.current.scrollHeight || 300, 400);
      const dropdownWidth = 320; // Largura fixa do dropdown
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // SEMPRE posicionar à direita do card, alinhado ao topo (como DetailSideCard)
      let calculatedLeft = documentLeft + rect.width + 10;
      let calculatedTop = documentTop; // Sempre alinhado ao topo do card
      
      // Se não cabe à direita, posicionar à esquerda (mas ainda alinhado ao topo)
      if ((calculatedLeft - scrollLeft) + dropdownWidth > viewportWidth) {
        calculatedLeft = documentLeft - dropdownWidth - 10;
      }
      
      // Garantir que não saia da tela à esquerda
      if ((calculatedLeft - scrollLeft) < 10) {
        calculatedLeft = scrollLeft + 10;
      }
      
      // Ajustar verticalmente APENAS se o dropdown sair da tela por baixo
      // Priorizar manter alinhado ao topo
      const topInViewport = calculatedTop - scrollTop;
      if (topInViewport + dropdownHeight > viewportHeight) {
        // Se sair por baixo, verificar se há mais espaço acima ou abaixo
        const spaceAbove = topInViewport;
        const spaceBelow = viewportHeight - topInViewport;
        
        if (spaceAbove > spaceBelow && spaceAbove >= dropdownHeight) {
          // Mais espaço acima e cabe, ajustar para cima
          calculatedTop = scrollTop + viewportHeight - dropdownHeight - 10;
        }
        // Caso contrário, manter alinhado ao topo (pode ter scroll no dropdown)
      }
      
      // Garantir que não saia da tela por cima
      if ((calculatedTop - scrollTop) < 10) {
        calculatedTop = scrollTop + 10;
      }
      
      // Aplicar posição usando position: absolute (EXATAMENTE como DetailSideCard)
      dropdownRef.current.style.position = 'absolute';
      dropdownRef.current.style.left = `${calculatedLeft}px`;
      dropdownRef.current.style.top = `${calculatedTop}px`;
      dropdownRef.current.style.width = `${dropdownWidth}px`;
      dropdownRef.current.style.maxHeight = '400px';
      dropdownRef.current.style.zIndex = '100001';
      dropdownRef.current.style.bottom = 'auto';
    };

    // Atualizar posição imediatamente
    updatePosition();
    
    // Usar requestAnimationFrame para atualizar após renderização
    let rafId = requestAnimationFrame(() => {
      updatePosition();
    });
    
    // Atualizar posição no scroll e resize usando requestAnimationFrame para suavidade
    let scrollRafId = null;
    const handleScroll = () => {
      if (scrollRafId) return; // Evitar múltiplas chamadas
      scrollRafId = requestAnimationFrame(() => {
        updatePosition();
        scrollRafId = null;
      });
    };
    
    const handleResize = () => {
      updatePosition();
    };
    
    // Escutar scroll em window e document
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    
    // Usar MutationObserver para detectar mudanças no DOM que possam afetar a posição
    const observer = new MutationObserver(() => {
      updatePosition();
    });
    
    // Observar mudanças no body e no container pai
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
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
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
          {colaboradorSelecionado ? (
            <Avatar
              avatarId={colaboradorSelecionado.foto_perfil || null}
              nomeUsuario={colaboradorSelecionado.nome}
              size="small"
              className="responsavel-card-avatar"
            />
          ) : (
            <i 
              className="fas fa-user-tie" 
              style={{ 
                marginRight: '8px', 
                color: '#6b7280',
                flexShrink: 0
              }}
            ></i>
          )}
          <span className={`responsavel-card-text ${colaboradorSelecionado ? 'has-selection' : ''}`}>
            {displayText}
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
        {/* Campo de busca */}
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
        
        {/* Lista de opções */}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const isSelected = normalizeValue(option.value) === normalizeValue(value);
            const colaboradorOption = colaboradores.find(c => 
              normalizeValue(c.id) === normalizeValue(option.value)
            );
            
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
                {colaboradorOption ? (
                  <Avatar
                    avatarId={colaboradorOption.foto_perfil || null}
                    nomeUsuario={colaboradorOption.nome}
                    size="small"
                    className="responsavel-card-option-avatar"
                  />
                ) : (
                  <div 
                    className="responsavel-card-option-avatar-placeholder"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <i className="fas fa-user" style={{ fontSize: '12px', color: '#9ca3af' }}></i>
                  </div>
                )}
                <span className="responsavel-card-option-label">{option.label}</span>
                {isSelected && (
                  <i className="fas fa-check" style={{ 
                    marginLeft: 'auto', 
                    color: '#0e3b6f',
                    fontSize: '14px'
                  }}></i>
                )}
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

