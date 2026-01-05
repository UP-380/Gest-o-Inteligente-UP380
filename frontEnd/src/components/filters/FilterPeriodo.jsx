import React, { useState, useEffect, useRef } from 'react';
import './FilterPeriodo.css';

const FilterPeriodo = ({ dataInicio, dataFim, onInicioChange, onFimChange, disabled = false, size = 'default', showWeekendToggle = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localInicio, setLocalInicio] = useState(dataInicio || '');
  const [localFim, setLocalFim] = useState(dataFim || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [habilitarFinaisSemana, setHabilitarFinaisSemana] = useState(false);
  const containerRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  const handleDateClick = (date) => {
    if (disabled) return;

    // Se o toggle está visível e finais de semana não estão habilitados e a data é final de semana, não permitir seleção
    if (showWeekendToggle && !habilitarFinaisSemana && isWeekend(date)) {
      return;
    }

    const dateStr = formatDateForInput(date);
    const dateObj = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (!localInicio || (localInicio && localFim)) {
      // Primeiro clique ou reset: definir início
      setLocalInicio(dateStr);
      setLocalFim('');
      setSelectingStart(true);
      
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
      const isDisabled = showWeekendToggle && !habilitarFinaisSemana && isWeekendDay;
      
      // Adicionar classe para finais de semana desabilitados
      if (isDisabled) {
        dayClasses += ' weekend-disabled';
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

      days.push(
        <div
          key={day}
          className={dayClasses}
          onClick={() => !isDisabled && handleDateClick(currentDate)}
          style={isDisabled ? { cursor: 'not-allowed', opacity: 0.4 } : {}}
        >
          {day}
        </div>
      );
    }

    return { monthYear, days };
  };

  const { monthYear, days } = renderCalendar();

  return (
    <>
      <div className={`periodo-filter-container ${size === 'small' ? 'size-small' : ''}`} ref={containerRef}>
        <div className="periodo-select-field">
          <div 
            className={`periodo-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
            onClick={handleOpen}
          >
            <i className="fas fa-calendar-alt" style={{ marginRight: '8px', color: '#6c757d' }}></i>
            <span className={`periodo-select-text ${(localInicio && localFim) ? 'has-selection' : ''}`}>
              {textoDisplay}
            </span>
            <i className={`fas ${isOpen ? 'fa-chevron-down' : 'fa-chevron-up'} periodo-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
          </div>
          {isOpen && !disabled && (
            <div className="periodo-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="periodo-dropdown-content">
                <div style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <i className="fas fa-calendar-alt" style={{ color: '#4b5563', fontSize: '14px' }}></i>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>Filtro de período</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', maxWidth: '240px', marginLeft: 'auto', marginRight: 'auto' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6c757d', fontWeight: 500, marginBottom: '4px' }}>Início</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={formatarData(localInicio)} 
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', background: '#f9fafb', cursor: 'pointer', color: '#495057' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6c757d', fontWeight: 500, marginBottom: '4px' }}>Vencimento</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={formatarData(localFim)} 
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', background: '#f9fafb', cursor: 'pointer', color: '#495057' }}
                      />
                    </div>
                  </div>

                  {/* Toggle para habilitar finais de semana - apenas se showWeekendToggle for true */}
                  {showWeekendToggle && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', whiteSpace: 'nowrap' }}>
                        Habilitar finais de semana:
                      </label>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <input
                          type="checkbox"
                          id="toggleFinaisSemana"
                          checked={habilitarFinaisSemana}
                          onChange={(e) => setHabilitarFinaisSemana(e.target.checked)}
                          style={{
                            width: '44px',
                            height: '24px',
                            appearance: 'none',
                            backgroundColor: habilitarFinaisSemana ? 'var(--primary-blue, #0e3b6f)' : '#cbd5e1',
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
                            left: habilitarFinaisSemana ? '22px' : '2px',
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
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FilterPeriodo;
