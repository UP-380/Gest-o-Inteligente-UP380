import React, { useState, useEffect, useRef } from 'react';
import './FilterDate.css';

/**
 * Componente de filtro de data com calendário visual
 * 
 * @param {Object} props
 * @param {string} props.label - Label do filtro (padrão: "A partir de")
 * @param {string} props.value - Valor da data (formato YYYY-MM-DD)
 * @param {Function} props.onChange - Função chamada ao alterar a data
 * @param {boolean} props.disabled - Se o input está desabilitado
 * @param {string} props.className - Classes CSS adicionais
 */
const FilterDate = ({
  label = 'A partir de',
  value,
  onChange,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef(null);

  // Formatar data para exibição
  const formatarData = (dataStr) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const textoDisplay = localValue ? formatarData(localValue) : 'Selecionar data';

  useEffect(() => {
    setLocalValue(value || '');
    // Se houver valor, ajustar o mês atual para mostrar o mês da data selecionada
    if (value) {
      const date = new Date(value + 'T00:00:00');
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleDateClick = (date) => {
    if (disabled) return;

    const dateStr = formatDateForInput(date);
    setLocalValue(dateStr);
    setIsOpen(false);
    
    if (onChange) {
      onChange({ target: { value: dateStr } });
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
      days.push(<div key={`empty-${i}`} className="date-calendar-day empty"></div>);
    }

    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      let dayClasses = 'date-calendar-day';
      
      // Verificar se é a data selecionada
      if (localValue) {
        const selectedDate = new Date(localValue + 'T00:00:00');
        const selectedDateObj = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        const isSelected = isSameDay(currentDate, selectedDateObj);
        
        if (isSelected) {
          dayClasses += ' selected';
        }
      }

      days.push(
        <div
          key={day}
          className={dayClasses}
          onClick={() => handleDateClick(currentDate)}
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
      <label className="filter-label">{label}</label>
      <div className={`date-filter-container ${className}`} ref={containerRef}>
        <div className="date-select-field">
          <div 
            className={`date-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
            onClick={handleOpen}
          >
            <i className="fas fa-calendar-alt" style={{ marginRight: '8px', color: '#64748b', fontSize: '13px' }}></i>
            <span className={`date-select-text ${localValue ? 'has-selection' : ''}`}>
              {textoDisplay}
            </span>
            <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} date-select-arrow ${isOpen ? 'rotated' : ''}`}></i>
          </div>
          {isOpen && !disabled && (
            <div className="date-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="date-dropdown-content">
                <div style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <i className="fas fa-calendar-alt" style={{ color: '#4b5563', fontSize: '14px' }}></i>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>Selecionar data</span>
                  </div>
                  
                  {localValue && (
                    <div style={{ marginBottom: '10px', maxWidth: '240px', marginLeft: 'auto', marginRight: 'auto' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#6c757d', fontWeight: 500, marginBottom: '4px' }}>Data selecionada</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={formatarData(localValue)} 
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', background: '#f9fafb', cursor: 'pointer', color: '#495057' }}
                      />
                    </div>
                  )}

                  <div className="date-calendar-container">
                    <div className="date-calendar-header">
                      <button className="date-calendar-nav" type="button" onClick={handlePrevMonth}>
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <span className="date-calendar-month-year">{monthYear}</span>
                      <button className="date-calendar-nav" type="button" onClick={handleNextMonth}>
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                    <div className="date-calendar-weekdays">
                      <div>D</div>
                      <div>S</div>
                      <div>T</div>
                      <div>Q</div>
                      <div>Q</div>
                      <div>S</div>
                      <div>S</div>
                    </div>
                    <div className="date-calendar-days">
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

export default FilterDate;

