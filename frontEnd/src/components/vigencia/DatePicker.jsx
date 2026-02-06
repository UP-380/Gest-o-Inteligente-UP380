import React, { useState, useEffect, useRef } from 'react';
import '../filters/FilterPeriodo.css';

const DatePicker = ({ value, onChange, disabled = false, className = '', error = false, size = 'small' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localDate, setLocalDate] = useState(value || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef(null);

  // Formatar data para exibição
  const formatarData = (dataStr) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const textoDisplay = localDate ? formatarData(localDate) : 'Selecionar data';

  useEffect(() => {
    setLocalDate(value || '');
    // Se houver uma data, definir o mês atual para mostrar essa data
    if (value) {
      const dateObj = new Date(value + 'T00:00:00');
      if (!isNaN(dateObj.getTime())) {
        setCurrentMonth(new Date(dateObj.getFullYear(), dateObj.getMonth(), 1));
      }
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
    setLocalDate(dateStr);
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
      days.push(<div key={`empty-${i}`} className="periodo-calendar-day empty"></div>);
    }

    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      let dayClasses = 'periodo-calendar-day';
      
      // Verificar se é a data selecionada
      if (localDate) {
        const selectedDate = new Date(localDate + 'T00:00:00');
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
    <div className={`periodo-filter-container ${size === 'small' ? 'size-small' : ''} ${className}`} ref={containerRef}>
      <div className="periodo-select-field">
        <div 
          className={`periodo-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''} ${error ? 'error' : ''}`}
          onClick={handleOpen}
        >
          <i className="fas fa-calendar-alt" style={{ marginRight: '8px', color: '#6c757d', fontSize: '13px', lineHeight: '1.4' }}></i>
          <span className={`periodo-select-text ${localDate ? 'has-selection' : ''}`}>
            {textoDisplay}
          </span>
          <i className={`fas ${isOpen ? 'fa-chevron-down' : 'fa-chevron-up'} periodo-select-arrow ${isOpen ? 'rotated' : ''}`} style={{ fontSize: '12px', lineHeight: '1.4' }}></i>
        </div>
        {isOpen && !disabled && (
          <div className="periodo-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="periodo-dropdown-content">
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <i className="fas fa-calendar-alt" style={{ color: '#4b5563', fontSize: '14px' }}></i>
                  <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>Selecionar data</span>
                </div>

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
  );
};

export default DatePicker;

