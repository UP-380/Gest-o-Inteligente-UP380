import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './FilterPeriodo.css';

const FilterPeriodo = ({ dataInicio, dataFim, onInicioChange, onFimChange, disabled = false, size = 'default', uiVariant, showWeekendToggle = false, onWeekendToggleChange, showHolidayToggle = false, onHolidayToggleChange, datasIndividuais = [], onDatasIndividuaisChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localInicio, setLocalInicio] = useState(dataInicio || '');
  const [localFim, setLocalFim] = useState(dataFim || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [habilitarFinaisSemana, setHabilitarFinaisSemana] = useState(false);
  const [habilitarFeriados, setHabilitarFeriados] = useState(false);
  const [feriados, setFeriados] = useState({}); // { "2026-01-01": "Confraternização mundial", ... }
  const [hoveredHoliday, setHoveredHoliday] = useState(null); // { date: "2026-01-01", name: "...", x: 100, y: 200 }
  const [datasIndividuaisLocal, setDatasIndividuaisLocal] = useState(new Set(datasIndividuais || []));
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const isAtribuicaoMini = uiVariant === 'atribuicao-mini';

  // Formatar data para exibição
  const formatarData = (dataStr) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const textoDisplay = (localInicio && localFim)
    ? `${formatarData(localInicio)} - ${formatarData(localFim)}`
    : localInicio
    ? `${formatarData(localInicio)} - ...`
    : 'Selecionar período';

  useEffect(() => {
    setLocalInicio(dataInicio || '');
    setLocalFim(dataFim || '');
  }, [dataInicio, dataFim]);

  // Sincronizar datas individuais com prop do pai
  useEffect(() => {
    if (!Array.isArray(datasIndividuais)) return;
    const newSet = new Set(datasIndividuais);
    setDatasIndividuaisLocal(prev => {
      if (prev.size === newSet.size && [...prev].every(v => newSet.has(v))) {
        return prev;
      }
      return newSet;
    });
  }, [JSON.stringify(datasIndividuais)]);

  // Limpar datas individuais fora do período quando o período mudar
  useEffect(() => {
    if (localInicio && localFim) {
      const inicioDate = new Date(localInicio + 'T00:00:00');
      const fimDate = new Date(localFim + 'T00:00:00');
      const novasDatas = new Set();
      
      datasIndividuaisLocal.forEach(dataStr => {
        const data = new Date(dataStr + 'T00:00:00');
        if (data >= inicioDate && data <= fimDate) {
          novasDatas.add(dataStr);
        }
      });
      
      if (novasDatas.size !== datasIndividuaisLocal.size) {
        setDatasIndividuaisLocal(novasDatas);
        if (onDatasIndividuaisChange) {
          onDatasIndividuaisChange(Array.from(novasDatas));
        }
      }
    } else {
      // Se não há período, limpar todas as datas individuais
      if (datasIndividuaisLocal.size > 0) {
        setDatasIndividuaisLocal(new Set());
        if (onDatasIndividuaisChange) {
          onDatasIndividuaisChange([]);
        }
      }
    }
  }, [localInicio, localFim]);

  // Notificar o componente pai sobre o valor inicial do toggle e quando mudar
  useEffect(() => {
    if (showWeekendToggle && onWeekendToggleChange) {
      onWeekendToggleChange(habilitarFinaisSemana);
    }
  }, [showWeekendToggle, habilitarFinaisSemana, onWeekendToggleChange]);

  // Notificar o componente pai sobre o valor inicial do toggle de feriados e quando mudar
  useEffect(() => {
    if (showHolidayToggle && onHolidayToggleChange) {
      onHolidayToggleChange(habilitarFeriados);
    }
  }, [showHolidayToggle, habilitarFeriados, onHolidayToggleChange]);

  // Buscar feriados quando o mês mudar - sempre buscar para visualização
  useEffect(() => {
    const buscarFeriados = async () => {
      const year = currentMonth.getFullYear();
      try {
        const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
        if (response.ok) {
          const feriadosData = await response.json();
          const feriadosMap = {};
          feriadosData.forEach(feriado => {
            feriadosMap[feriado.date] = feriado.name;
          });
          setFeriados(feriadosMap);
        }
      } catch (error) {
        console.error('Erro ao buscar feriados:', error);
      }
    };

    buscarFeriados();
  }, [currentMonth]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideContainer = containerRef.current && containerRef.current.contains(event.target);
      const clickedInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
      if (!clickedInsideContainer && !clickedInsideDropdown) {
        // Só fechar se ambas as datas estiverem selecionadas
        if (localInicio && localFim) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, localInicio, localFim]);

  // Calcular posição do dropdown (portal) baseado no trigger
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const calc = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width
      });
    };
    calc();
    window.addEventListener('scroll', calc, true);
    window.addEventListener('resize', calc);
    return () => {
      window.removeEventListener('scroll', calc, true);
      window.removeEventListener('resize', calc);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  // Verificar se é final de semana (sábado = 6, domingo = 0)
  const isWeekend = (date) => {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  // Verificar se é feriado
  const isHoliday = (date) => {
    const dateStr = formatDateForInput(date);
    return feriados[dateStr] !== undefined;
  };

  // Obter nome do feriado
  const getHolidayName = (date) => {
    const dateStr = formatDateForInput(date);
    return feriados[dateStr];
  };

  const handleDateClick = (date, event) => {
    if (disabled) return;

    // Verificar se Ctrl (ou Cmd no Mac) está pressionado
    const isCtrlPressed = event && (event.ctrlKey || event.metaKey);
    
    // Se Ctrl está pressionado e há um período selecionado, gerenciar datas individuais
    if (isCtrlPressed && localInicio && localFim) {
      const dateStr = formatDateForInput(date);
      const dateObj = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const inicioDate = new Date(localInicio + 'T00:00:00');
      const fimDate = new Date(localFim + 'T00:00:00');
      const inicioDateObj = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), inicioDate.getDate());
      const fimDateObj = new Date(fimDate.getFullYear(), fimDate.getMonth(), fimDate.getDate());
      
      // Verificar se a data está dentro do período
      if (dateObj >= inicioDateObj && dateObj <= fimDateObj) {
        const novasDatas = new Set(datasIndividuaisLocal);
        
        // Se a data já está selecionada, remover; caso contrário, adicionar
        if (novasDatas.has(dateStr)) {
          novasDatas.delete(dateStr);
        } else {
          novasDatas.add(dateStr);
        }
        
        setDatasIndividuaisLocal(novasDatas);
        
        // Notificar o componente pai
        if (onDatasIndividuaisChange) {
          onDatasIndividuaisChange(Array.from(novasDatas));
        }
      }
      return; // Não continuar com a lógica normal de seleção de período
    }

    // Se o toggle está visível e finais de semana não estão habilitados e a data é final de semana, não permitir seleção
    if (showWeekendToggle && !habilitarFinaisSemana && isWeekend(date)) {
      return;
    }

    // Se o toggle está visível e feriados não estão habilitados e a data é feriado, não permitir seleção
    if (showHolidayToggle && !habilitarFeriados && isHoliday(date)) {
      return;
    }

    const dateStr = formatDateForInput(date);
    const dateObj = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (!localInicio || (localInicio && localFim)) {
      // Primeiro clique ou reset: definir início
      setLocalInicio(dateStr);
      setLocalFim('');
      setSelectingStart(true);
      
      // Limpar datas individuais ao resetar período
      if (datasIndividuaisLocal.size > 0) {
        setDatasIndividuaisLocal(new Set());
        if (onDatasIndividuaisChange) {
          onDatasIndividuaisChange([]);
        }
      }
      
      if (onInicioChange) {
        onInicioChange({ target: { value: dateStr } });
      }
      if (onFimChange) {
        onFimChange({ target: { value: '' } });
      }
    } else if (localInicio && !localFim) {
      // Segundo clique: definir fim
      const inicioDate = new Date(localInicio + 'T00:00:00');
      const inicioDateObj = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), inicioDate.getDate());
      
      let newInicio = localInicio;
      let newFim = dateStr;
      
      if (dateObj < inicioDateObj) {
        // Se a data selecionada for anterior à de início, trocar
        newFim = localInicio;
        newInicio = dateStr;
      }
      
      setLocalInicio(newInicio);
      setLocalFim(newFim);
      setSelectingStart(false);
      
      if (onInicioChange) {
        onInicioChange({ target: { value: newInicio } });
      }
      if (onFimChange) {
        onFimChange({ target: { value: newFim } });
      }
    }
  };

  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const isDateInRange = (date, start, end) => {
    const dateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    return dateTime >= startTime && dateTime <= endTime;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 
                      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const monthYear = `${monthNames[month]} de ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];

    // Dias vazios do início
    for (let i = 0; i < firstDayWeekday; i++) {
      days.push(<div key={`empty-${i}`} className="periodo-calendar-day empty"></div>);
    }

    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      let dayClasses = 'periodo-calendar-day';
      const isWeekendDay = isWeekend(currentDate);
      const isHolidayDay = isHoliday(currentDate);
      const holidayName = isHolidayDay ? getHolidayName(currentDate) : null;
      const isDisabledWeekend = showWeekendToggle && !habilitarFinaisSemana && isWeekendDay;
      const isDisabledHoliday = showHolidayToggle && !habilitarFeriados && isHolidayDay;
      const isDisabled = isDisabledWeekend || isDisabledHoliday;
      
      // Adicionar classe para finais de semana desabilitados
      if (isDisabledWeekend) {
        dayClasses += ' weekend-disabled';
      }
      
      // Adicionar classe para feriados
      if (isHolidayDay) {
        dayClasses += ' holiday';
        if (isDisabledHoliday) {
          dayClasses += ' holiday-disabled';
        }
      }
      
      // Verificar se é data de início ou fim
      if (localInicio) {
        const inicioDate = new Date(localInicio + 'T00:00:00');
        const inicioDateObj = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), inicioDate.getDate());
        const isStartDate = isSameDay(currentDate, inicioDateObj);
        
        if (isStartDate) {
          dayClasses += ' selected start-date';
        }
        
        if (localFim) {
          const fimDate = new Date(localFim + 'T00:00:00');
          const fimDateObj = new Date(fimDate.getFullYear(), fimDate.getMonth(), fimDate.getDate());
          const isEndDate = isSameDay(currentDate, fimDateObj);
          
          if (isEndDate) {
            dayClasses += ' selected end-date';
          }
          
          // Adicionar classe in-range apenas para datas entre início e fim
          if (!isStartDate && !isEndDate && isDateInRange(currentDate, inicioDateObj, fimDateObj)) {
            dayClasses += ' in-range';
          }
        }
      }

      // Verificar se é uma data individual selecionada/desselecionada
      const dateStr = formatDateForInput(currentDate);
      const isIndividualSelected = datasIndividuaisLocal.has(dateStr);
      if (isIndividualSelected) {
        dayClasses += ' individual-selected';
      }

      days.push(
        <div
          key={day}
          className={dayClasses}
          onClick={(e) => !isDisabled && handleDateClick(currentDate, e)}
          onMouseEnter={(e) => {
            if (isHolidayDay && holidayName) {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoveredHoliday({ 
                date: formatDateForInput(currentDate), 
                name: holidayName,
                x: e.clientX,
                y: e.clientY
              });
            }
          }}
          onMouseMove={(e) => {
            if (isHolidayDay && holidayName && hoveredHoliday) {
              setHoveredHoliday({ 
                date: formatDateForInput(currentDate), 
                name: holidayName,
                x: e.clientX,
                y: e.clientY
              });
            }
          }}
          onMouseLeave={() => {
            setHoveredHoliday(null);
          }}
          style={{
            ...(isDisabled ? { cursor: 'not-allowed', opacity: 0.4 } : {}),
            position: 'relative'
          }}
        >
          {day}
          {isHolidayDay && (
            <span className="holiday-indicator" style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isDisabledHoliday ? '#ef4444' : '#f59e0b',
              display: 'block'
            }}></span>
          )}
        </div>
      );
    }

    return { monthYear, days };
  };

  const { monthYear, days } = renderCalendar();

  return (
    <>
      {/* Tooltip de feriado - renderizado via Portal para garantir que fique acima de tudo */}
      {hoveredHoliday && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${hoveredHoliday.x + 10}px`,
            top: `${hoveredHoliday.y - 35}px`,
            padding: '6px 10px',
            backgroundColor: '#1f2937',
            color: '#fff',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            zIndex: 100002,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
            maxWidth: '250px',
            fontWeight: '500'
          }}
        >
          {hoveredHoliday.name}
        </div>,
        document.body
      )}
      <div className={`periodo-filter-container ${size === 'small' ? 'size-small' : ''} ${isAtribuicaoMini ? 'variant-atribuicao-mini' : ''}`} ref={containerRef}>
        <div 
          className="periodo-select-field"
          style={{
            position: 'relative',
            display: 'inline-block'
          }}
        >
          <div 
            className={`periodo-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
            onClick={handleOpen}
            style={
              size === 'small'
                ? (isAtribuicaoMini
                  ? { padding: '4px 10px', fontSize: '11px', minHeight: '26px', lineHeight: '16px' }
                  : { padding: '6px 10px', fontSize: '12px', minHeight: '28px', lineHeight: '16px' }
                )
                : undefined
            }
            ref={triggerRef}
          >
            <i className="fas fa-calendar-alt" style={{ marginRight: '8px', color: '#6c757d' }}></i>
            <span className={`periodo-select-text ${(localInicio && localFim) ? 'has-selection' : ''}`}>
              {textoDisplay}
            </span>
            <i className={`fas ${isOpen ? 'fa-chevron-down' : 'fa-chevron-up'} periodo-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
          </div>
          {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
            <div
              className="periodo-dropdown"
              ref={dropdownRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${dropdownPos.top}px`,
                left: `${dropdownPos.left}px`,
                zIndex: 100000,
                width: isAtribuicaoMini ? 260 : (size === 'small' ? 320 : Math.max(340, dropdownPos.width)),
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
            >
              <div className="periodo-dropdown-content">
                <div style={{ padding: isAtribuicaoMini ? '8px' : '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: isAtribuicaoMini ? '4px' : (size === 'small' ? '6px' : '10px') }}>
                    <i className="fas fa-calendar-alt" style={{ color: '#4b5563', fontSize: size === 'small' ? '12px' : '14px' }}></i>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: isAtribuicaoMini ? '11px' : (size === 'small' ? '12px' : '13px') }}>Filtro de período</span>
                  </div>
                  
                  {/* Na variante da Nova Atribuição, o período é mostrado no display (compacto) e não precisa desses inputs */}
                  {!isAtribuicaoMini && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: size === 'small' ? '8px' : '10px', maxWidth: size === 'small' ? '220px' : '240px', marginLeft: 'auto', marginRight: 'auto' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: size === 'small' ? '10px' : '11px', color: '#6c757d', fontWeight: 500, marginBottom: '4px' }}>Início</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={formatarData(localInicio)} 
                          style={{ width: '100%', padding: size === 'small' ? '4px 8px' : '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: size === 'small' ? '12px' : '14px', fontFamily: 'inherit', background: '#f9fafb', cursor: 'pointer', color: '#495057' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: size === 'small' ? '10px' : '11px', color: '#6c757d', fontWeight: 500, marginBottom: '4px' }}>Vencimento</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={formatarData(localFim)} 
                          style={{ width: '100%', padding: size === 'small' ? '4px 8px' : '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: size === 'small' ? '12px' : '14px', fontFamily: 'inherit', background: '#f9fafb', cursor: 'pointer', color: '#495057' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Toggle para habilitar finais de semana - apenas se showWeekendToggle for true */}
                  {showWeekendToggle && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isAtribuicaoMini ? 'flex-start' : 'center', gap: isAtribuicaoMini ? '6px' : '8px', marginBottom: isAtribuicaoMini ? '4px' : (size === 'small' ? '8px' : '10px') }}>
                      <label style={{ fontSize: isAtribuicaoMini ? '10px' : (size === 'small' ? '11px' : '12px'), fontWeight: '500', color: '#374151', whiteSpace: 'nowrap' }}>
                        Habilitar finais de semana:
                      </label>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <input
                          type="checkbox"
                          id="toggleFinaisSemana"
                          checked={habilitarFinaisSemana}
                          onChange={(e) => {
                            const novoValor = e.target.checked;
                            setHabilitarFinaisSemana(novoValor);
                            if (onWeekendToggleChange) {
                              onWeekendToggleChange(novoValor);
                            }
                          }}
                          style={{
                            width: isAtribuicaoMini ? '34px' : '44px',
                            height: isAtribuicaoMini ? '18px' : '24px',
                            appearance: 'none',
                            backgroundColor: habilitarFinaisSemana ? 'var(--primary-blue, #0e3b6f)' : '#cbd5e1',
                            borderRadius: isAtribuicaoMini ? '10px' : '12px',
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
                            top: isAtribuicaoMini ? '2px' : '2px',
                            left: habilitarFinaisSemana ? (isAtribuicaoMini ? '18px' : '22px') : '2px',
                            width: isAtribuicaoMini ? '14px' : '20px',
                            height: isAtribuicaoMini ? '14px' : '20px',
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

                  {/* Toggle para habilitar feriados - apenas se showHolidayToggle for true */}
                  {showHolidayToggle && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isAtribuicaoMini ? 'flex-start' : 'center', gap: isAtribuicaoMini ? '6px' : '8px', marginBottom: isAtribuicaoMini ? '4px' : (size === 'small' ? '8px' : '10px') }}>
                      <label style={{ fontSize: isAtribuicaoMini ? '10px' : (size === 'small' ? '11px' : '12px'), fontWeight: '500', color: '#374151', whiteSpace: 'nowrap' }}>
                        Habilitar feriados:
                      </label>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <input
                          type="checkbox"
                          id="toggleFeriados"
                          checked={habilitarFeriados}
                          onChange={(e) => {
                            const novoValor = e.target.checked;
                            setHabilitarFeriados(novoValor);
                            if (onHolidayToggleChange) {
                              onHolidayToggleChange(novoValor);
                            }
                          }}
                          style={{
                            width: isAtribuicaoMini ? '34px' : '44px',
                            height: isAtribuicaoMini ? '18px' : '24px',
                            appearance: 'none',
                            backgroundColor: habilitarFeriados ? 'var(--primary-blue, #0e3b6f)' : '#cbd5e1',
                            borderRadius: isAtribuicaoMini ? '10px' : '12px',
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
                            top: isAtribuicaoMini ? '2px' : '2px',
                            left: habilitarFeriados ? (isAtribuicaoMini ? '18px' : '22px') : '2px',
                            width: isAtribuicaoMini ? '14px' : '20px',
                            height: isAtribuicaoMini ? '14px' : '20px',
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


                  <div className="periodo-calendar-container">
                    <div className="periodo-calendar-header">
                      <button className="periodo-calendar-nav" type="button" onClick={handlePrevMonth}>
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <span className="periodo-calendar-month-year">{monthYear}</span>
                      <button className="periodo-calendar-nav" type="button" onClick={handleNextMonth}>
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                    <div className="periodo-calendar-weekdays">
                      <div>D</div>
                      <div>S</div>
                      <div>T</div>
                      <div>Q</div>
                      <div>Q</div>
                      <div>S</div>
                      <div>S</div>
                    </div>
                    <div className="periodo-calendar-days">
                      {days}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </>
  );
};

export default FilterPeriodo;
